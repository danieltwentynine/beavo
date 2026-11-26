import { router } from 'expo-router';
import { CheckCircle, LockSimple, Play } from 'phosphor-react-native';
import { useContext, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Riverbank, useRiverbankMotion } from '@/components/brushing/Riverbank';
import { SlotIcon } from '@/components/brushing/SlotIcon';
import { Card } from '@/components/ui/Card';
import { GrownupsNavigation } from '@/components/ui/GrownupsNavigation';
import { useParentalGate } from '@/components/ui/ParentalGate';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { TabHeader } from '@/components/ui/TabHeader';
import { useLiveReduceMotion } from '@/hooks/useLiveReduceMotion';
import { useActiveChild } from '@/hooks/useActiveChild';
import { useSessionHistory } from '@/hooks/useSessions';
import { db } from '@/lib/firebase';
import { locale, t } from '@/lib/i18n';
import { colors, motion, pressShadow, radius, shadow, size } from '@/lib/tokens';
import { ownerIdOf, useAuthStore } from '@/stores/authStore';
import { latestCompletionsForDay } from '@/src/data/progress';
import { updateChild } from '@/src/data/children';
import { localDate, slotAt, slotsActiveOn } from '@/src/data/schedule';
import type { BrushingSession, BrushingSlot } from '@/types';

const GAP = 10;
/** Fits the 196 pt halo at its largest breath. */
const HALO_BOX = 208;
const formatTime = (date: Date) => date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

/** 1–3 slots: one row. 4: 2×2. 5–6: rows of 3. Never overflows. */
const columnsFor = (n: number) => (n <= 3 ? Math.max(n, 1) : n === 4 ? 2 : 3);

/** The current minute, refreshed every 30 s so "current slot" follows the clock. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function slotIconColor(icon: string, selected: boolean) {
  if (icon === 'sun' || icon === 'sun-horizon' || icon === 'cloud-sun') {
    return selected ? colors.slotSunOnPrimary : colors.slotSun;
  }
  if (selected) return colors.onPrimary;
  return icon === 'moon' ? colors.slotMoon : colors.ink;
}

function SlotCard({
  slot,
  width,
  session,
  current,
  target,
  onPress,
}: {
  slot: BrushingSlot;
  width: number;
  session: BrushingSession | undefined;
  current: boolean;
  target: boolean;
  onPress: () => void;
}) {
  const done = session !== undefined;
  const time = session ? formatTime(session.startedAt) : null;
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={t('today.slotA11y', {
        label: current ? `${slot.label}, ${t('today.now')}` : slot.label,
        state: time ? t('today.doneAt', { time }) : t('today.notYet'),
      })}
      accessibilityState={{ selected: target }}
      padding={8}
      style={{
        width, alignItems: 'center', justifyContent: 'center', rowGap: 4, minHeight: 144, paddingTop: 28,
        backgroundColor: target ? colors.primary : current ? colors.primarySoft : done ? colors.slotDone : colors.surface,
        borderBottomWidth: 5, borderBottomColor: target ? colors.primaryPress : colors.line,
      }}
    >
      {current ? (
        <View style={{ position: 'absolute', top: -12, backgroundColor: colors.secondary, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2 }}>
          <Text className="font-display-semi" style={{ fontSize: 16, color: colors.onSecondary }}>
            {t('today.now')}
          </Text>
        </View>
      ) : null}
      {done ? (
        <CheckCircle size={24} color={target ? colors.onPrimary : colors.primary} weight="fill"
          style={{ position: 'absolute', right: 8, top: 15 }} />
      ) : (
        <View style={{ position: 'absolute', right: 8, top: 15, width: 22, height: 22, borderRadius: 11,
          borderWidth: 2, borderStyle: 'dashed', borderColor: target ? colors.onPrimary : colors.zoneLine }} />
      )}
      <SlotIcon icon={slot.icon} size={34} color={slotIconColor(slot.icon, target)} weight="fill" />
      <Text className="font-display-semi" style={{ fontSize: 16, textAlign: 'center',
        color: target ? colors.onPrimary : colors.ink }}>
        {slot.label}
      </Text>
      {time ? (
        <Text className="font-numeric" style={{ fontSize: 18, color: target ? colors.onPrimary : colors.primary }}>
          {time}
        </Text>
      ) : null}
    </Card>
  );
}

/** Big round start button with a soft (flat) halo that breathes unless Reduce Motion is on. */
function StartButton({ label, disabled, animated, onPress }: { label: string; disabled: boolean; animated: boolean; onPress: () => void }) {
  const breath = useSharedValue(0);
  useEffect(() => {
    if (!animated || disabled) {
      breath.value = 0;
      return;
    }
    breath.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(breath);
  }, [breath, animated, disabled]);
  const haloStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breath.value * 0.05 }] }));

  // The play disc and halo share a square, leaving the caption clear of the animation.
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: HALO_BOX, height: HALO_BOX, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', width: 196, height: 196, borderRadius: 98, backgroundColor: colors.halo, opacity: disabled ? 0.4 : 1 }, haloStyle]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onPress}
          style={[
            {
              width: 164,
              height: 164,
              borderRadius: 82,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: disabled ? colors.sessionTrack : colors.primary,
            },
            pressShadow(disabled),
          ]}
        >
          <Play size={52} color={disabled ? colors.inkMuted : colors.onPrimary} weight="fill" />
        </Pressable>
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={[{ backgroundColor: colors.surface, borderRadius: radius.pill, marginTop: 12, paddingHorizontal: 20, paddingVertical: 8 }, shadow.card]}>
        <Text className="font-display" style={{ fontSize: 20, color: colors.ink, textAlign: 'center' }}>{label}</Text>
      </View>
    </View>
  );
}

function GrownupsChip({ onPress }: { onPress: () => void }) {
  const [pressed, setPressed] = useState(false);
  const reduceMotion = useLiveReduceMotion();
  const label = t('kidLock.chip');
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduceMotion ? 1 : withTiming(pressed ? motion.pressScale : 1, { duration: 100 }) }],
  }));
  return (
    <Animated.View style={[{ alignSelf: 'center' }, pressStyle]}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={t('kidLock.hint')}
        onPress={onPress} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
        style={{
          flexDirection: 'row', alignItems: 'center', columnGap: 8,
          minHeight: size.targetMin, paddingHorizontal: 20, borderRadius: radius.pill,
          borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.primarySoft,
        }}>
        <LockSimple size={20} weight="bold" color={colors.primaryPress} />
        <Text className="font-display" style={{ fontSize: 16, color: colors.primaryPress }}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

/** Today only: the active child's slots, the start button and protected access to Grownups. */
export default function BrushingTab() {
  const animated = useRiverbankMotion();
  const insets = useSafeAreaInsets();
  const [grownupsBottom, setGrownupsBottom] = useState(0);
  const uid = useAuthStore(ownerIdOf);
  const { child, slots } = useActiveChild();
  const history = useSessionHistory();
  const now = useNow();
  const today = localDate(now);
  const { gate, requireParent } = useParentalGate();
  const { unlockingChildId, setUnlockingChildId } = useContext(GrownupsNavigation);
  const [gridWidth, setGridWidth] = useState(0);
  // A tapped card overrides the slot the clock picks (or is the only way to pick, between windows).
  const [picked, setPicked] = useState<{ childId: string | null; slotId: string } | null>(null);

  const openGrownups = () => {
    if (!child || !uid || unlockingChildId) return;
    requireParent(() => {
      setUnlockingChildId(child.id);
      // The child watcher reflects local writes even while offline.
      void updateChild(db, uid, child.id, { kidMode: false }).catch(() => {
        setUnlockingChildId((pending) => pending === child.id ? null : pending);
      });
    });
  };

  const todaySlots = slotsActiveOn(slots, today);
  const current = slotAt(todaySlots, now);
  const pickedSlot = picked && picked.childId === child?.id ? todaySlots.find((s) => s.id === picked.slotId) : undefined;
  const target = pickedSlot ?? current;

  const latestBySlot = latestCompletionsForDay(history?.items ?? [], today);

  const cols = columnsFor(todaySlots.length);
  const cardWidth = gridWidth > 0 ? (gridWidth - GAP * (cols - 1)) / cols : 0;

  const start = () => {
    if (!target) return;
    router.push({ pathname: '/session', params: { slotId: target.id } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Riverbank animated={animated} clearThrough={child?.kidMode && grownupsBottom > 0 ? insets.top + grownupsBottom + 8 : 0} />
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center', padding: 20, paddingTop: 4, rowGap: 16 }}>
          <TabHeader title={t('tabs.brushing')} />
          <View>
            <SectionTitle>{t('today.title')}</SectionTitle>
            <View
              onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
              style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: GAP, rowGap: GAP + 8, paddingTop: 10 }}
            >
              {cardWidth > 0
                ? todaySlots.map((slot) => (
                    <SlotCard
                      key={slot.id}
                      slot={slot}
                      width={cardWidth}
                      session={latestBySlot.get(slot.id)}
                      current={slot.id === current?.id}
                      target={slot.id === target?.id}
                      onPress={() => setPicked({ childId: child?.id ?? null, slotId: slot.id })}
                    />
                  ))
                : null}
            </View>
          </View>

          <View style={{ height: 16 }} />
          <StartButton
            animated={animated}
            label={target ? t('today.startFor', { label: target.label }) : t('today.pickSlot')}
            disabled={!target}
            onPress={start}
          />

          {child?.kidMode && uid ? (
            <View onLayout={({ nativeEvent: { layout } }) => setGrownupsBottom(layout.y + layout.height)}>
              <GrownupsChip onPress={openGrownups} />
            </View>
          ) : null}
        </ScrollView>
        {gate}
      </SafeAreaView>
    </View>
  );
}
