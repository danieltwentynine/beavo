import { router } from 'expo-router';
import { CheckCircle, LockSimple, PencilSimple, Play } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SlotIcon } from '@/components/brushing/SlotIcon';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { useParentalGate } from '@/components/ui/ParentalGate';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { TabHeader } from '@/components/ui/TabHeader';
import { useActiveChild } from '@/hooks/useActiveChild';
import { useSessions } from '@/hooks/useSessions';
import { db } from '@/lib/firebase';
import { t } from '@/lib/i18n';
import { pressShadow, radius, tokens } from '@/lib/tokens';
import { ownerIdOf, useAuthStore } from '@/stores/authStore';
import { updateChild } from '@/src/data/children';
import { background } from '@/src/data/firestore';
import { localDate, slotAt, slotsActiveOn } from '@/src/data/schedule';
import type { BrushingSession, BrushingSlot } from '@/types';

const GAP = 10;
const formatTime = (date: Date) => date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

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
  const done = session?.completed ?? false;
  const time = session ? formatTime(session.startedAt) : t('today.noTime');
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={t('today.slotA11y', {
        label: current ? `${slot.label}, ${t('today.now')}` : slot.label,
        state: session ? t('today.doneAt', { time }) : t('today.notYet'),
      })}
      padding={12}
      tone={target ? 'primary' : current ? 'soft' : 'plain'}
      style={{ width, alignItems: 'center', rowGap: 6, minHeight: 124 }}
    >
      {current ? (
        <View style={{ position: 'absolute', top: -12, backgroundColor: tokens.secondary, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2 }}>
          <Text className="font-display-semi" style={{ fontSize: 12, color: tokens.onSecondary }}>
            {t('today.now')}
          </Text>
        </View>
      ) : null}
      {done ? (
        <CheckCircle size={30} color={target ? tokens.textOnBrand : tokens.brandPrimary} weight="fill" />
      ) : (
        <SlotIcon icon={slot.icon} size={30} color={target ? tokens.textOnBrand : tokens.textPrimary} weight="fill" />
      )}
      <Text
        className="font-display-semi"
        numberOfLines={2}
        style={{ fontSize: 15, textAlign: 'center', color: target ? tokens.textOnBrand : tokens.textPrimary }}
      >
        {slot.label}
      </Text>
      <Text className="font-numeric" style={{ fontSize: 18, color: target ? tokens.textOnBrand : session ? tokens.textLink : tokens.textSecondary }}>
        {time}
      </Text>
    </Card>
  );
}

/** Big round start button with a soft (flat) halo that breathes unless Reduce Motion is on. */
function StartButton({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion || disabled) {
      breath.value = 0;
      return;
    }
    breath.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [breath, reduceMotion, disabled]);
  const haloStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breath.value * 0.06 }] }));

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', height: 230 }}>
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', width: 212, height: 212, borderRadius: 106, backgroundColor: tokens.primarySoft, opacity: disabled ? 0.4 : 1 }, haloStyle]}
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
            rowGap: 4,
            backgroundColor: disabled ? tokens.sessionTrack : tokens.brandPrimary,
          },
          pressShadow(disabled),
        ]}
      >
        <Play size={52} color={tokens.textOnBrand} weight="fill" />
      </Pressable>
      <Text className="font-display" style={{ fontSize: 20, color: tokens.textPrimary, marginTop: 14, textAlign: 'center' }}>
        {label}
      </Text>
    </View>
  );
}

/** Today only: the active child's slots, the start button, kid mode and routine editing. */
export default function BrushingTab() {
  const uid = useAuthStore(ownerIdOf);
  const { child, slots } = useActiveChild();
  const sessions = useSessions();
  const now = useNow();
  const today = localDate(now);
  const { gate, requireParent } = useParentalGate();
  const [gridWidth, setGridWidth] = useState(0);
  // A tapped card overrides the slot the clock picks (or is the only way to pick, between windows).
  const [picked, setPicked] = useState<{ childId: string | null; slotId: string } | null>(null);

  const todaySlots = slotsActiveOn(slots, today);
  const current = slotAt(todaySlots, now);
  const pickedSlot = picked && picked.childId === child?.id ? todaySlots.find((s) => s.id === picked.slotId) : undefined;
  const target = pickedSlot ?? current;

  // Latest session per slot today.
  const latestBySlot = new Map<string, BrushingSession>();
  for (const s of sessions) {
    if (s.date !== today) continue;
    const prev = latestBySlot.get(s.slotId);
    if (!prev || s.startedAt > prev.startedAt) latestBySlot.set(s.slotId, s);
  }

  const cols = columnsFor(todaySlots.length);
  const cardWidth = gridWidth > 0 ? (gridWidth - GAP * (cols - 1)) / cols : 0;

  const start = () => {
    if (!target) return;
    router.push({ pathname: '/session', params: { slotId: target.id } });
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.surfacePage }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, rowGap: 18 }}>
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

        <StartButton
          label={target ? t('today.startFor', { label: target.label }) : t('today.pickSlot')}
          disabled={!target}
          onPress={start}
        />

        {child && uid ? (
          <Card padding={0}>
            <ListRow
              Icon={LockSimple}
              label={t('today.kidMode')}
              hint={t('today.kidModeHint')}
              right={
                <Switch
                  accessibilityLabel={t('today.kidMode')}
                  value={child.kidMode}
                  trackColor={{ true: tokens.brandPrimary, false: tokens.zoneLine }}
                  // The switch never flips by itself: the gate decides.
                  onValueChange={(next) =>
                    requireParent(() => background(updateChild(db, uid, child.id, { kidMode: next })))
                  }
                />
              }
            />
            <ListRow Icon={PencilSimple} label={t('today.editRoutine')} onPress={() => requireParent(() => router.push('/slots'))} last />
          </Card>
        ) : null}
      </ScrollView>
      {gate}
    </SafeAreaView>
  );
}
