import { router } from 'expo-router';
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
import { useActiveChild } from '@/hooks/useActiveChild';
import { buildCoachMessage } from '@/lib/coach';
import { ALL_TOOTH_ZONES, BRUSHING_DURATION_SECONDS, COUNTDOWN_SECONDS } from '@/lib/constants';
import { outline, palette, tokens } from '@/lib/tokens';
import { useSessionStore } from '@/stores/sessionStore';
import type { ToothZone } from '@/types';

const ZONE_HINTS: Record<ToothZone, string> = {
  'top-front': 'Brush your top front teeth',
  'top-left': 'Now the top left',
  'top-right': 'Now the top right',
  'top-back-left': 'Reach the top back left',
  'top-back-right': 'Reach the top back right',
  'bottom-front': 'Down to the bottom front',
  'bottom-left': 'Bottom left now',
  'bottom-right': 'Bottom right — nice!',
  'bottom-back-left': "Back teeth — you've got this",
  'bottom-back-right': 'Last one — keep going!',
};

export default function SessionScreen() {
  const { child } = useActiveChild();
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
  const [remaining, setRemaining] = useState(BRUSHING_DURATION_SECONDS);
  const remainingRef = useRef(BRUSHING_DURATION_SECONDS);
  const startedAtRef = useRef<Date | null>(null);
  const finishedRef = useRef(false);
  const childName = child?.name ?? 'friend';

  // Zone progress is derived from the clock: one source of truth, no drift.
  const elapsed = BRUSHING_DURATION_SECONDS - remaining;
  const zonesReached = Math.min(
    ALL_TOOTH_ZONES.length,
    Math.floor((elapsed / BRUSHING_DURATION_SECONDS) * ALL_TOOTH_ZONES.length),
  );

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

    const total = BRUSHING_DURATION_SECONDS;
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
    // Local, reviewed templates only. AI tips (lib/gemini.ts) are off: re-enabling
    // them needs a privacy-policy update first (CLAUDE.md > Gemini).
    const coachMessage = buildCoachMessage(child.name, missed, score);

    setLastResult({
      childId: child.id,
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
  }, [child, setLastResult, saveLastResult]);

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
    <View style={{ flex: 1, backgroundColor: palette.cobalt[900] }}>
      <StatusBar style="light" />
      {cameraOn ? <CameraBackdrop /> : null}
      <SafeAreaView style={{ flex: 1 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel brushing"
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
            backgroundColor: tokens.surfaceCard,
            alignItems: 'center',
            justifyContent: 'center',
            ...outline,
          }}
        >
          <X size={22} color={tokens.textPrimary} weight="bold" />
        </Pressable>

        {askingForCamera ? (
          <CameraGate onAllow={() => void camera.requestPermission()} onSkip={() => setSkipCamera(true)} />
        ) : phase === 'countdown' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', rowGap: 10 }}>
            <Text className="font-numeric" style={{ fontSize: 140, color: tokens.feedbackReward, lineHeight: 150 }}>
              {count <= 0 ? 'Go!' : count}
            </Text>
            <Text className="font-body-semi" style={{ fontSize: 18, color: tokens.textOnBrand }}>
              Get your toothbrush ready, {childName}!
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20 }}>
            {/* Guided-brushing indicator (Phase 1 has no zone detection yet) */}
            <View style={{ marginTop: 8 }}>
              <Sticker label="Follow Sparky's guide" />
            </View>

            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <MouthMap states={zoneStates} size={260} />
            </View>

            <Text
              className="font-display"
              style={{ fontSize: 24, color: tokens.textOnBrand, textAlign: 'center', minHeight: 32 }}
            >
              {ZONE_HINTS[currentZone]}
            </Text>

            <View style={{ marginVertical: 18 }}>
              <BrushTimer remaining={remaining} total={BRUSHING_DURATION_SECONDS} size={150} />
            </View>

            <Button label="I'm done" variant="outline" size="sm" fullWidth={false} onPress={finish} />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
