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
import { cardShadow, motion, radius, tokens } from '@/lib/tokens';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { scoreSession } from '@/src/data/score';
import type { ToothZone } from '@/types';

export default function SessionScreen() {
  const { child } = useActiveChild();
  // Slot chosen on the Brushing tab; the length is fixed for this session when it opens.
  const { slotId } = useLocalSearchParams<{ slotId?: string }>();
  const [total] = useState<number>(() => useSettingsStore.getState().brushingDurationSec);
  const setLastResult = useSessionStore((s) => s.setLastResult);
  const saveLastResult = useSessionStore((s) => s.saveLastResult);

  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const mapSize = Math.min(height < 700 ? 220 : 260, width - 48);
  const timerSize = height < 700 ? 130 : 150;
  const reduceMotion = useReducedMotion();
  const [controlPressed, setControlPressed] = useState(false);
  // Each new cheer is pressed on like a sticker; with Reduce Motion it cross-fades in instead.
  const cheerIn = reduceMotion
    ? FadeIn.duration(250).reduceMotion(ReduceMotion.Never)
    : ZoomIn.springify().damping(19).stiffness(180);
  const camera = useCameraPermission();
  const device = useCameraDevice('front');
  const [skipCamera, setSkipCamera] = useState(false);
  const mirrorDevice = camera.hasPermission && !skipCamera ? device : undefined;

  const [phase, setPhase] = useState<'countdown' | 'active' | 'paused'>('countdown');
  // A late camera discovery must not interrupt brushing once the guide starts.
  const askingForCamera = phase === 'countdown' && !!device && camera.canRequestPermission && !skipCamera;
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
  const zonesReached = Math.min(ALL_TOOTH_ZONES.length, Math.floor((elapsed / total) * ALL_TOOTH_ZONES.length));

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
    const reached = Math.min(
      ALL_TOOTH_ZONES.length,
      Math.floor((elapsedAtFinish / total) * ALL_TOOTH_ZONES.length),
    );

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
      remainingRef.current = next;
      setRemaining(Math.max(0, next));
      if (next <= 0) {
        clearInterval(interval);
        finish();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [active, finish]);

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
    if (active) setPhase('paused');
    else stopWithoutSaving();
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.sessionBg }}>
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
              position: 'absolute',
              top: insets.top + 12,
              right: 20,
              zIndex: 5,
              width: 56,
              height: 56,
              borderRadius: 28,
              transform: [{ scale: controlPressed && !reduceMotion ? motion.pressScale : 1 }],
              ...cardShadow,
            }}
          >
            <GlassSurface interactive ground="session" style={{ flex: 1, borderRadius: 28, alignItems: 'center', justifyContent: 'center' }}>
              {active ? <Pause size={24} color={tokens.textPrimary} weight="fill" /> : <X size={24} color={tokens.textPrimary} weight="bold" />}
            </GlassSurface>
          </Pressable>
        )}

        {askingForCamera ? (
          <CameraGate onAllow={() => void camera.requestPermission()} onSkip={() => setSkipCamera(true)} />
        ) : phase === 'countdown' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', rowGap: 16, paddingHorizontal: 24 }}>
            <GlassSurface ground="session" tint={tokens.sessionPill}
              style={{ width: 200, height: 200, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' }}>
              <Text accessibilityLiveRegion="assertive" className="font-numeric"
                numberOfLines={1} adjustsFontSizeToFit
                style={{ fontSize: 112, color: tokens.brandPrimaryPress, lineHeight: 120 }}>
                {count <= 0 ? t('session.go') : count}
              </Text>
            </GlassSurface>
            <GlassSurface ground="session" tint={tokens.sessionPill}
              style={{ minHeight: 44, paddingVertical: 10, paddingHorizontal: 18, borderRadius: radius.pill }}>
              <Text className="font-body-semi" style={{ fontSize: 18, lineHeight: 24, color: tokens.textPrimary, textAlign: 'center' }}>
                {t('session.ready', { name: childName })}
              </Text>
            </GlassSurface>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 4 }}>
            <Animated.View key={zonesReached} entering={cheerIn} style={{ marginTop: 8, marginHorizontal: 52 }}>
              <Sticker label={brushingCheer(zonesReached)} />
            </Animated.View>

            <View style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 8 }}>
              <View style={{ backgroundColor: tokens.surfaceCard, borderRadius: radius.pill, ...cardShadow }}>
                <MouthMap states={zoneStates} size={mapSize} />
              </View>
              <SideLabels left={t('mouth.yourLeft')} right={t('mouth.yourRight')} width={mapSize} session />
              <GlassSurface ground="session" tint={tokens.sessionPill}
                style={{ minHeight: 56, marginTop: 12, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 28, maxWidth: '100%', justifyContent: 'center' }}>
                <Text accessibilityLiveRegion="polite" className="font-display" numberOfLines={2}
                  style={{ fontSize: 22, lineHeight: 28, color: tokens.textPrimary, textAlign: 'center' }}>
                  {zoneInstruction}
                </Text>
              </GlassSurface>
            </View>

            <View style={{ marginVertical: 18 }}>
              <BrushTimer remaining={remaining} total={total} size={timerSize} />
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
