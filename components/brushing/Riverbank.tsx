import { useIsFocused } from 'expo-router';
import { memo, type ReactNode, useEffect, useState } from 'react';
import { AppState, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { G, Path, Svg } from 'react-native-svg';

import { useLiveReduceMotion } from '@/hooks/useLiveReduceMotion';
import { colors } from '@/lib/tokens';

import { babyBeaver, beaverOnDam, cloud, duck, fish, floatingLog, reed1, reed2, reed3, reed4, riverbankBackdrop, sunRays } from './riverbankArt';

const SCENE_WIDTH = 390;
const SCENE_HEIGHT = 844;
const MAX_SCALE = 1.4;
const WATER_TOP = 655;

type Bounds = [x: number, y: number, width: number, height: number];
type Layer = {
  bounds: Bounds;
  art: ReactNode;
  motion: 'spin' | 'cloud' | 'ripple' | 'reed' | 'bob' | 'log' | 'swim' | 'fish';
  period: number;
  phase?: number;
};

function cloudAt(x: number, y: number, scale: number, period: number, phase: number): Layer {
  return { bounds: [x, y, 74 * scale, 36 * scale], art: <G transform={`translate(${x} ${y}) scale(${scale})`}>{cloud}</G>, motion: 'cloud', period, phase };
}

function ripples(rows: number[], period: number): Layer {
  return {
    bounds: [-6, rows[0] - 2, 520, rows[rows.length - 1] - rows[0] + 4],
    art: rows.map((y, i) => (
      <Path key={y} d={`M${i * 20 - 22} ${y} ${'h74 m46 0 '.repeat(5)}`}
        stroke={colors.sceneRipple} strokeWidth={3} strokeLinecap="round" opacity={0.8} fill="none" />
    )),
    motion: 'ripple',
    period,
  };
}

const LAYERS: Layer[] = [
  { bounds: [6, 358, 104, 104], art: sunRays, motion: 'spin', period: 60000 },
  cloudAt(250, 366, 0.9, 46000, 32036),
  cloudAt(-20, 352, 0.5, 70000, 15000),
  cloudAt(150, 500, 0.55, 58000, 30036),
  ripples([690, 752], 9000),
  ripples([722], 12000),
  { bounds: [4, 606, 12, 84], art: reed1, motion: 'reed', period: 4500 },
  { bounds: [13, 598, 12, 92], art: reed2, motion: 'reed', period: 4500, phase: 1000 },
  { bounds: [22, 588, 12, 102], art: reed3, motion: 'reed', period: 4500, phase: 2000 },
  { bounds: [31, 578, 12, 112], art: reed4, motion: 'reed', period: 4500, phase: 3000 },
  { bounds: [300, 500, 92, 88], art: beaverOnDam, motion: 'bob', period: 3600 },
  { bounds: [148, 728, 74, 20], art: floatingLog, motion: 'log', period: 26000 },
  { bounds: [-6, 684, 50, 32], art: babyBeaver, motion: 'swim', period: 38000 },
  { bounds: [50, 678, 48, 34], art: <G transform="translate(72 700)">{duck}</G>, motion: 'bob', period: 2800 },
  { bounds: [88, 694, 48, 34], art: <G transform="translate(110 716)">{duck}</G>, motion: 'bob', period: 3300, phase: 1200 },
  { bounds: [208, 714, 42, 20], art: <G transform="translate(220 724)">{fish}</G>, motion: 'fish', period: 8000 },
];

const SceneLayer = memo(function SceneLayer({ layer, scale, clock, animated }: { layer: Layer; scale: number; clock: SharedValue<number>; animated: boolean }) {
  const [x, y, width, height] = layer.bounds;
  const { motion, period, phase = 0 } = layer;
  const style = useAnimatedStyle(() => {
    if (!animated) return { transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }] };
    const t = ((clock.value + phase) % period) / period;
    const ease = motion === 'reed' || motion === 'bob' || motion === 'log'
      ? (1 - Math.cos(t * 2 * Math.PI)) / 2 : 0;
    switch (motion) {
      case 'spin': return { transform: [{ rotate: `${360 * t}deg` }] };
      case 'cloud': return { transform: [{ translateX: (-140 + 560 * t - x) * scale }] };
      case 'ripple': return { transform: [{ translateX: -120 * t * scale }] };
      case 'reed': return { transform: [{ rotate: `${-3 + 6 * ease}deg` }] };
      case 'bob': return { transform: [{ translateY: -4 * ease * scale }] };
      case 'log': return { transform: [{ translateX: -90 * ease * scale }] };
      case 'swim': return { transform: [{ translateX: (-60 + 490 * t) * scale }] };
      case 'fish': {
        const jump = Math.max(0, Math.min(1, (t - 0.8) / 0.16));
        return {
          opacity: Math.max(0, Math.min(1, (t - 0.78) / 0.02, (1 - t) / 0.04)),
          transform: [
            { translateX: 26 * jump * scale },
            { translateY: (-38 * Math.sin(jump * Math.PI) + 6 * Math.max(0, (t - 0.96) / 0.04)) * scale },
            { rotate: `${-40 + 80 * jump}deg` },
          ],
        };
      }
    }
  });

  if (motion === 'fish' && !animated) return null;
  return (
    <Animated.View style={[
      { position: 'absolute', left: x * scale, top: y * scale, width: width * scale, height: height * scale },
      motion === 'reed' && { transformOrigin: 'center bottom' },
      style,
    ]}>
      <Svg width="100%" height="100%" viewBox={layer.bounds.join(' ')}>{layer.art}</Svg>
    </Animated.View>
  );
});

export function useRiverbankMotion() {
  const focused = useIsFocused();
  const reduced = useLiveReduceMotion();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const app = AppState.addEventListener('change', (status) => setForeground(status === 'active'));
    return () => app.remove();
  }, []);
  return focused && foreground && !reduced;
}

/** Artwork stays behind the safe-area content. Only small native sprite views move. */
export const Riverbank = memo(function Riverbank({ animated, clearThrough = 0 }: { animated: boolean; clearThrough?: number }) {
  const { width } = useWindowDimensions();
  const scale = Math.min(width / SCENE_WIDTH, MAX_SCALE);
  const [viewportHeight, setViewportHeight] = useState(0);
  const waterTop = viewportHeight - (SCENE_HEIGHT - WATER_TOP) * scale;
  const waterShift = viewportHeight ? Math.max(0, clearThrough - waterTop) : 0;
  const clock = useSharedValue(0);
  const frame = useFrameCallback(({ timeSincePreviousFrame }) => {
    clock.value += timeSincePreviousFrame ?? 0;
  }, false);

  useEffect(() => {
    frame.setActive(animated);
    return () => frame.setActive(false);
  }, [animated, frame]);

  return (
    <View onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
      pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.sceneSkyTop, justifyContent: 'flex-end', alignItems: 'center', overflow: 'hidden' }]}>
      <View style={{ width: SCENE_WIDTH * scale, height: SCENE_HEIGHT * scale, transform: [{ translateY: waterShift }], overflow: 'hidden' }}>
        <Svg width="100%" height="100%" viewBox="0 0 390 844">{riverbankBackdrop}</Svg>
        {LAYERS.map((layer) => <SceneLayer key={layer.bounds.join(':')} layer={layer} scale={scale} clock={clock} animated={animated} />)}
      </View>
    </View>
  );
});
