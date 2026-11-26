import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pause, X } from 'phosphor-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, BackHandler, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

import { SessionPauseCard } from '@/components/brushing/SessionPauseCard';
import { CameraBackdrop } from '@/components/brushing/CameraBackdrop';
import { CameraGate } from '@/components/brushing/CameraGate';
import { BrushTimer } from '@/components/brushing/BrushTimer';
import { MouthMap, type ZoneState } from '@/components/brushing/MouthMap';
import { Sticker } from '@/components/kids/Sticker';
import { Button } from '@/components/ui/Button';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { SideLabels } from '@/components/ui/SideLabels';
import { useActiveChild } from '@/hooks/useActiveChild';
import { brushingCheer, buildCoachMessage } from '@/lib/coach';
import { ALL_TOOTH_ZONES, COUNTDOWN_SECONDS } from '@/lib/constants';
import { t } from '@/lib/i18n';
import { colors, motion, radius, shadow } from '@/lib/tokens';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { scoreSession } from '@/src/data/score';
import type { ToothZone } from '@/types';

const CONTROL_SIZE = 56;
const CONTROL_GAP = 12;
const COUNTDOWN_MAX_FONT_SCALE = 1.25;

function countReachedZones(elapsed: number, total: number) {
  return Math.min(ALL_TOOTH_ZONES.length, Math.floor((elapsed / total) * ALL_TOOTH_ZONES.length));
}

export default function SessionScreen() {
  const { child } = useActiveChild();
  const [foamZone, setFoamZone] = useState<ToothZone>();
  // Slot chosen on the Brushing tab; the length is fixed for this session when it opens.
  const { slotId } = useLocalSearchParams<{ slotId?: string }>();
  const [total] = useState<number>(() => useSettingsStore.getState().brushingDurationSec);
  const setLastResult = useSessionStore((s) => s.setLastResult);
  const saveLastResult = useSessionStore((s) => s.saveLastResult);

  const insets = useSafeAreaInsets();
  const { fontScale, height, width } = useWindowDimensions();
  const mapSize = Math.min(height < 700 ? 220 : 260, width - 48);
  const timerSize = height < 700 ? 130 : 150;
  const reduceMotion = useReducedMotion();
  const [controlPressed, setControlPressed] = useState(false);
  // Only the opening cheer animates so later cheers do not overlap the foam effect.
  const cheerIn = reduceMotion
    ? FadeIn.duration(250).reduceMotion(ReduceMotion.Never)
    : ZoomIn.springify().damping(19).stiffness(180);
  const camera = useCameraPermission();
  const device = useCameraDevice('front');
  const [skipCamera, setSkipCamera] = useState(false);

  const [phase, setPhase] = useState<'countdown' | 'active' | 'paused'>('countdown');
  // A late camera discovery must not interrupt brushing once the guide starts.
  const askingForCamera = phase === 'countdown' && !!device && camera.canRequestPermission && !skipCamera;
  const countdownVisible = phase === 'countdown' && !askingForCamera;
  const mirrorDevice = camera.hasPermission && !skipCamera && !askingForCamera ? device : undefined;
  const [count, setCount] = useState(COUNTDOWN_SECONDS);
  const [remaining, setRemaining] = useState(total);
  const remainingRef = useRef(total);
  const startedAtRef = useRef<Date | null>(null);
  const finishedRef = useRef(false);
  const childName = child?.name ?? t('common.friend');

  // Zone progress is derived from the clock: one source of truth, no drift.
  const elapsed = total - remaining;
  const paused = phase === 'paused';
  const active = phase === 'active';
  const doneVisible = elapsed >= Math.min(30, Math.floor(total / 4));
  const zonesReached = countReachedZones(elapsed, total);

  const zoneStates = useMemo(() => {
    const ns: Partial<Record<ToothZone, ZoneState>> = {};
    ALL_TOOTH_ZONES.forEach((z, i) => {
      if (i < zonesReached) ns[z] = 'done';
      else if (i === zonesReached) ns[z] = 'active';
    });
    return ns;
  }, [zonesReached]);

  // Countdown 3 → 2 → 1 → Go!
  useEffect(() => {
    if (phase !== 'countdown' || askingForCamera) return;
    const t = setTimeout(() => {
      if (count > 0) {
        setCount((c) => c - 1);
        return;
      }
      // "Go!" has been on screen for a beat: brushing starts now.
      startedAtRef.current = new Date();
      setPhase(AppState.currentState === 'active' ? 'active' : 'paused');
    }, 800);
    return () => clearTimeout(t);
  }, [phase, count, askingForCamera]);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    const elapsedAtFinish = Math.min(total, Math.max(0, total - remainingRef.current));
    const reached = countReachedZones(elapsedAtFinish, total);

    const final: Partial<Record<ToothZone, ZoneState>> = {};
    const missed: ToothZone[] = [];
    ALL_TOOTH_ZONES.forEach((z, i) => {
      if (i < reached) {
        final[z] = 'done';
      } else {
        final[z] = 'missed';
        missed.push(z);
      }
    });

    const score = scoreSession({ reachedZones: reached, zoneCount: ALL_TOOTH_ZONES.length, totalSec: total });
    if (!child) {
      router.back();
      return;
    }
    // Local, reviewed templates only: AI tips need a privacy-policy update first (ADR 0003).
    const coachMessage = buildCoachMessage(child.name, missed, score);

    setLastResult({
      childId: child.id,
      slotId: slotId ?? null,
      startedAt: startedAtRef.current ?? new Date(Date.now() - elapsedAtFinish * 1000),
      completed: elapsedAtFinish >= total,
      totalSec: total,
      score,
      zoneStates: final,
      missed,
      durationSeconds: elapsedAtFinish,
      coachMessage,
    });

    // Fire-and-forget: the store reports progress to the results screen, so a
    // slow or offline write never holds the child on the session screen.
    void saveLastResult();

    setTimeout(() => router.replace('/results'), 350);
  }, [child, slotId, total, setLastResult, saveLastResult]);

  // Active session — a 2-minute guided walk through every zone. Side effects
  // live in the interval callback so the state updaters stay pure.
  useEffect(() => {
    if (!active || finishedRef.current) return;
    const interval = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      const next = remainingRef.current - 1;
      const previousReached = countReachedZones(total - remainingRef.current, total);
      const nextReached = countReachedZones(total - next, total);
      if (nextReached > previousReached && !reduceMotion) {
        setFoamZone(ALL_TOOTH_ZONES[nextReached - 1]);
      }
      remainingRef.current = next;
      setRemaining(Math.max(0, next));
      if (next <= 0) {
        clearInterval(interval);
        finish();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [active, finish, reduceMotion, total]);

  const currentZone = ALL_TOOTH_ZONES[Math.min(zonesReached, ALL_TOOTH_ZONES.length - 1)];
  const zoneInstruction = t(`zone.${currentZone}`);

  useEffect(() => {
    if (Platform.OS !== 'ios' || askingForCamera || phase !== 'active') return;
    // Announce only when the instructions change, never on each timer tick.
    const cue = currentZone === ALL_TOOTH_ZONES[0] ? `${t('session.go')} ${zoneInstruction}` : zoneInstruction;
    AccessibilityInfo.announceForAccessibility(cue);
  }, [askingForCamera, currentZone, phase, zoneInstruction]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && !finishedRef.current) {
        setFoamZone(undefined);
        setPhase((current) => current === 'active' ? 'paused' : current);
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (finishedRef.current) return true;
      if (paused) {
        setPhase('active');
        return true;
      }
      if (active) {
        setFoamZone(undefined);
        setPhase('paused');
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [active, paused]);

  const stopWithoutSaving = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/brushing');
  };

  const onControlPress = () => {
    if (finishedRef.current) return;
    if (active) {
      setFoamZone(undefined);
      setPhase('paused');
    } else {
      stopWithoutSaving();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.sessionBg }}>
      <StatusBar style={mirrorDevice ? 'light' : 'dark'} />
      {mirrorDevice ? <CameraBackdrop device={mirrorDevice} /> : null}
      <SafeAreaView
        accessibilityElementsHidden={paused}
        importantForAccessibility={paused ? 'no-hide-descendants' : 'auto'}
        style={{ flex: 1 }}
      >
        {paused ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(active ? 'session.pause' : 'session.cancel')}
            onPress={onControlPress}
            onPressIn={() => setControlPressed(true)}
            onPressOut={() => setControlPressed(false)}
            style={{
              width: CONTROL_SIZE,
              height: CONTROL_SIZE,
              ...(countdownVisible ? {
                alignSelf: 'flex-end',
                marginTop: CONTROL_GAP,
                marginRight: 20,
                marginBottom: CONTROL_GAP,
              } : {
                position: 'absolute',
                top: insets.top + CONTROL_GAP,
                right: 20,
                zIndex: 5,
              }),
              borderRadius: 28,
              transform: [{ scale: controlPressed && !reduceMotion ? motion.pressScale : 1 }],
              ...shadow.card,
            }}
          >
            <GlassSurface interactive ground="session" style={{ flex: 1, borderRadius: 28, alignItems: 'center', justifyContent: 'center' }}>
              {active ? <Pause size={24} color={colors.cameraControlInk} weight="fill" /> : <X size={24} color={colors.cameraControlInk} weight="bold" />}
            </GlassSurface>
          </Pressable>
        )}

        {askingForCamera ? (
          <CameraGate onAllow={() => void camera.requestPermission()} onSkip={() => setSkipCamera(true)} />
        ) : countdownVisible ? (
          <ScrollView style={{ flex: 1 }} contentInsetAdjustmentBehavior="never"
            contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', rowGap: 16,
              paddingHorizontal: 24, paddingBottom: 12 }}>
            <GlassSurface ground="session" tint={{ glass: colors.sessionPill }}
              style={{ minWidth: 156, minHeight: 156, maxWidth: '100%', paddingHorizontal: 24, paddingVertical: 10,
                borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' }}>
              <Text accessibilityLiveRegion="assertive" className="font-numeric"
                allowFontScaling={fontScale >= 1}
                maxFontSizeMultiplier={COUNTDOWN_MAX_FONT_SCALE}
                style={{ fontSize: count <= 0 ? 76 : 112, color: colors.primaryPress, textAlign: 'center' }}>
                {count <= 0 ? t('session.go') : count}
              </Text>
            </GlassSurface>
            <GlassSurface ground="session" tint={{ glass: colors.sessionPill }}
              style={{ minHeight: 44, maxWidth: '100%', paddingVertical: 10, paddingHorizontal: 18, borderRadius: radius.pill }}>
              <Text className="font-body-semi" style={{ fontSize: 18, lineHeight: 24, color: colors.ink, textAlign: 'center' }}>
                {t('session.ready', { name: childName })}
              </Text>
            </GlassSurface>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 4 }}>
            <Animated.View key={zonesReached} entering={zonesReached === 0 ? cheerIn : undefined} style={{ marginTop: 8, marginHorizontal: 52 }}>
              <Sticker label={brushingCheer(zonesReached)} />
            </Animated.View>

            <View style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 8 }}>
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.pill, ...shadow.card }}>
                <MouthMap states={zoneStates} size={mapSize} foamZone={active && !reduceMotion ? foamZone : undefined} />
              </View>
              <SideLabels left={t('mouth.yourLeft')} right={t('mouth.yourRight')} width={mapSize} session />
              <GlassSurface ground="session" tint={{ glass: colors.sessionPill }}
                style={{ minHeight: 56, marginTop: 12, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 28, maxWidth: '100%', justifyContent: 'center' }}>
                <Text accessibilityLiveRegion="polite" className="font-display"
                  style={{ fontSize: 22, lineHeight: 28, color: colors.ink, textAlign: 'center' }}>
                  {zoneInstruction}
                </Text>
              </GlassSurface>
            </View>

            <View style={{ marginVertical: 18, maxWidth: '100%' }}>
              <BrushTimer remaining={remaining} total={total} size={timerSize} translucent={!!mirrorDevice} />
            </View>

            <View style={{ minHeight: 48 }}>
              {doneVisible && !paused ? (
                <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(200)}>
                  <Button label={t('session.done')} variant="outline" size="sm" fullWidth={false} onPress={finish} />
                </Animated.View>
              ) : null}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
      {paused ? (
        <SessionPauseCard
          remaining={remaining}
          canSave={elapsed >= 10}
          reduceMotion={reduceMotion}
          onResume={() => setPhase('active')}
          onEnd={elapsed >= 10 ? finish : stopWithoutSaving}
        />
      ) : null}
    </View>
  );
}
