import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { X } from 'phosphor-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCameraPermission } from 'react-native-vision-camera';

import { CameraBackdrop } from '@/components/brushing/CameraBackdrop';
import { CameraGate } from '@/components/brushing/CameraGate';
import { BrushTimer } from '@/components/brushing/BrushTimer';
import { MouthMap, type ZoneState } from '@/components/brushing/MouthMap';
import { Sticker } from '@/components/kids/Sticker';
import { Button } from '@/components/ui/Button';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { useActiveChild } from '@/hooks/useActiveChild';
import { brushingCheer, buildCoachMessage } from '@/lib/coach';
import { ALL_TOOTH_ZONES, COUNTDOWN_SECONDS } from '@/lib/constants';
import { t } from '@/lib/i18n';
import { cardShadow, tokens } from '@/lib/tokens';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { ToothZone } from '@/types';

export default function SessionScreen() {
  const { child } = useActiveChild();
  // Slot chosen on the Brushing tab; the length is fixed for this session when it opens.
  const { slotId } = useLocalSearchParams<{ slotId?: string }>();
  const [total] = useState<number>(() => useSettingsStore.getState().brushingDurationSec);
  const setLastResult = useSessionStore((s) => s.setLastResult);
  const saveLastResult = useSessionStore((s) => s.saveLastResult);

  const insets = useSafeAreaInsets();
  const camera = useCameraPermission();
  const [skipCamera, setSkipCamera] = useState(false);
  // Ask once (with an explainer first); denied or skipped just means guided mode.
  const askingForCamera = camera.canRequestPermission && !skipCamera;
  const cameraOn = camera.hasPermission && !skipCamera;

  const [phase, setPhase] = useState<'countdown' | 'active'>('countdown');
  const [count, setCount] = useState(COUNTDOWN_SECONDS);
  const [remaining, setRemaining] = useState(total);
  const remainingRef = useRef(total);
  const startedAtRef = useRef<Date | null>(null);
  const finishedRef = useRef(false);
  const childName = child?.name ?? t('common.friend');

  // Zone progress is derived from the clock: one source of truth, no drift.
  const elapsed = total - remaining;
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
      setPhase('active');
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

    const score = Math.round((reached / ALL_TOOTH_ZONES.length) * 100);
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
    if (phase !== 'active') return;
    const interval = setInterval(() => {
      const next = remainingRef.current - 1;
      remainingRef.current = next;
      setRemaining(Math.max(0, next));
      if (next <= 0) {
        clearInterval(interval);
        finish();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, finish]);

  const currentZone = ALL_TOOTH_ZONES[Math.min(zonesReached, ALL_TOOTH_ZONES.length - 1)];

  return (
    <View style={{ flex: 1, backgroundColor: tokens.sessionBg }}>
      <StatusBar style="dark" />
      {cameraOn ? <CameraBackdrop /> : null}
      <SafeAreaView style={{ flex: 1 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('session.cancel')}
          onPress={() => router.back()}
          style={{
            // Absolute children ignore SafeAreaView padding — offset by the inset.
            position: 'absolute',
            top: insets.top + 12,
            right: 20,
            zIndex: 5,
            width: 48,
            height: 48,
            borderRadius: 24,
            ...cardShadow,
          }}
        >
          <GlassSurface interactive ground="session" style={{ flex: 1, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
            <X size={22} color={tokens.textPrimary} weight="bold" />
          </GlassSurface>
        </Pressable>

        {askingForCamera ? (
          <CameraGate onAllow={() => void camera.requestPermission()} onSkip={() => setSkipCamera(true)} />
        ) : phase === 'countdown' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', rowGap: 10 }}>
            <Text className="font-numeric" style={{ fontSize: 140, color: tokens.brandPrimary, lineHeight: 150 }}>
              {count <= 0 ? t('session.go') : count}
            </Text>
            <Text className="font-body-semi" style={{ fontSize: 18, color: tokens.textPrimary }}>
              {t('session.ready', { name: childName })}
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20 }}>
            {/* A cheer per step of the guide */}
            <View style={{ marginTop: 8 }}>
              <Sticker label={brushingCheer(zonesReached)} />
            </View>

            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <MouthMap states={zoneStates} size={260} />
            </View>

            <Text
              className="font-display"
              style={{ fontSize: 24, color: tokens.textPrimary, textAlign: 'center', minHeight: 32 }}
            >
              {t(`zone.${currentZone}`)}
            </Text>

            <View style={{ marginVertical: 18 }}>
              <BrushTimer remaining={remaining} total={total} size={150} />
            </View>

            <Button label={t('session.done')} variant="outline" size="sm" fullWidth={false} onPress={finish} />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
