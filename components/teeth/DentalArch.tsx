import { useEffect, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';

import { toothName } from '@/components/teeth/toothName';
import { t } from '@/lib/i18n';
import { font, palette, tokens } from '@/lib/tokens';
import {
  ARCH_CENTER_Y,
  ARCH_VIEWBOX,
  childRightOnViewerLeft,
  layoutArch,
  molarGroovePath,
  nearestTooth,
  toothPath,
  type ToothPlacement,
  type ToothStatus,
  type ViewPerspective,
} from '@/src/data/teeth';

/**
 * Chart perspective — one constant for the whole app. 'dentist': the chart
 * faces the child, as a dentist (or a parent looking into the child's mouth)
 * sees it, so the child's RIGHT side is on the screen's LEFT. It matches dental
 * charts and dentists' reports, so parents copying a report tap the same tooth.
 */
export const CHART_PERSPECTIVE: ViewPerspective = 'dentist';

/** Touch target radius in points: every tooth gets at least a 44pt circle (Apple HIG). */
const HIT_RADIUS_PT = 22;

const STATUS_FILL: Record<ToothStatus, string> = {
  symptom: palette.warning[500],
  treatment: palette.sky[400],
  both: palette.warning[500],
};
const BASE_FILL = palette.white;
const OUTLINE = palette.cobalt[400];
const OUTLINE_SELECTED = palette.cobalt[600];

const AnimatedG = Animated.createAnimatedComponent(G);
const LAYOUT = layoutArch(CHART_PERSPECTIVE);

export interface DentalArchProps {
  /** Rendered width in points; height follows the chart's aspect ratio. */
  size: number;
  selected: readonly number[];
  onSelect: (fdi: number) => void;
  /** Only changes the label and a11y hint here; the parent decides what a tap does. */
  multiSelect?: boolean;
  statusByTooth?: Partial<Record<number, ToothStatus>>;
}

function Tooth({
  tooth,
  index,
  selected,
  status,
  progress,
}: {
  tooth: ToothPlacement;
  index: number;
  selected: boolean;
  status: ToothStatus | undefined;
  progress: SharedValue<number>;
}) {
  // Staggered fade-in: each tooth starts a little after the previous one.
  const start = (index / LAYOUT.length) * 0.6;
  const animatedProps = useAnimatedProps(() => ({
    opacity: interpolate(progress.value, [start, start + 0.4], [0, 1], 'clamp'),
  }));
  const d = toothPath(tooth.kind, tooth.width, tooth.depth);
  const groove = molarGroovePath(tooth.kind, tooth.width, tooth.depth);
  const fill = status ? STATUS_FILL[status] : BASE_FILL;

  return (
    <AnimatedG animatedProps={animatedProps} transform={`translate(${tooth.x} ${tooth.y}) rotate(${tooth.rotation})`}>
      {/* Soft glow without blur (Toy box: no blurred shadows): a wide translucent halo. */}
      {selected ? <Path d={d} fill="none" stroke={tokens.brandPrimary} strokeWidth={9} strokeOpacity={0.28} /> : null}
      <Path
        d={d}
        fill={fill}
        fillOpacity={selected ? 1 : 0.65}
        stroke={status === 'both' ? palette.sky[600] : selected ? OUTLINE_SELECTED : OUTLINE}
        strokeWidth={status === 'both' ? 3 : selected ? 2.5 : 1.5}
      />
      {groove ? <Path d={groove} stroke={OUTLINE} strokeOpacity={0.4} strokeWidth={1.5} strokeLinecap="round" /> : null}
    </AnimatedG>
  );
}

const STATUS_A11Y: Record<ToothStatus, Parameters<typeof t>[0]> = {
  symptom: 'arch.statusSymptom',
  treatment: 'arch.statusTreatment',
  both: 'arch.statusBoth',
};

/**
 * The 20 primary teeth on two elliptical arcs. Drawing is one SVG; touches go
 * to one layer that picks the NEAREST tooth (so neighbouring 44pt targets
 * never steal each other's taps); VoiceOver gets one labelled button per tooth.
 */
export function DentalArch({ size, selected, onSelect, multiSelect = false, statusByTooth = {} }: DentalArchProps) {
  const scale = size / ARCH_VIEWBOX.width;
  const height = ARCH_VIEWBOX.height * scale;
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [progress, reduceMotion]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduceMotion ? 1 : interpolate(progress.value, [0, 1], [0.94, 1]) }],
  }));

  const centerLabel =
    selected.length === 0
      ? t('arch.pick')
      : selected.length === 1
        ? toothName(selected[0])
        : t('arch.selectedCount', { count: selected.length });

  const sideLabels = childRightOnViewerLeft(CHART_PERSPECTIVE)
    ? [t('arch.childRight'), t('arch.childLeft')]
    : [t('arch.childLeft'), t('arch.childRight')];

  const label = (text: string) => (
    <Text className="font-body-semi" style={{ fontSize: 13, color: tokens.textSecondary }}>
      {text}
    </Text>
  );

  return (
    <Animated.View style={[{ width: size, height }, containerStyle]}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
        <Svg width={size} height={height} viewBox={`0 0 ${ARCH_VIEWBOX.width} ${ARCH_VIEWBOX.height}`}>
          {LAYOUT.map((tooth, i) => (
            <Tooth
              key={tooth.fdi}
              tooth={tooth}
              index={i}
              selected={selectedSet.has(tooth.fdi)}
              status={statusByTooth[tooth.fdi]}
              progress={progress}
            />
          ))}
        </Svg>
      </View>

      {/* Orientation labels (decorative for VoiceOver: every tooth name says its side). */}
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', inset: 0 }}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}>{label(t('arch.top'))}</View>
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' }}>{label(t('arch.bottom'))}</View>
        <View style={{ position: 'absolute', top: ARCH_CENTER_Y * scale - 32, left: 0 }}>{label(sideLabels[0])}</View>
        <View style={{ position: 'absolute', top: ARCH_CENTER_Y * scale - 32, right: 0 }}>{label(sideLabels[1])}</View>
      </View>

      {/* Center label: announced politely when it changes. */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: size * 0.2, right: size * 0.2, top: ARCH_CENTER_Y * scale - 22, height: 44, justifyContent: 'center' }}
      >
        <Text
          accessibilityLiveRegion="polite"
          numberOfLines={2}
          adjustsFontSizeToFit
          style={{ fontFamily: font.displaySemi, fontSize: 17, color: tokens.textPrimary, textAlign: 'center' }}
        >
          {centerLabel}
        </Text>
      </View>

      {/* Touch layer: nearest tooth within a 44pt circle wins. */}
      <Pressable
        accessible={false}
        style={{ position: 'absolute', inset: 0 }}
        onPress={(e) => {
          const fdi = nearestTooth(LAYOUT, e.nativeEvent.locationX / scale, e.nativeEvent.locationY / scale, HIT_RADIUS_PT / scale);
          if (fdi !== null) onSelect(fdi);
        }}
      />

      {/* VoiceOver: one 44pt button per tooth, read by name; activation doesn't depend on touch geometry. */}
      {LAYOUT.map((tooth) => {
        const status = statusByTooth[tooth.fdi];
        return (
          <View
            key={tooth.fdi}
            pointerEvents="none"
            accessible
            accessibilityRole="button"
            accessibilityLabel={status ? `${toothName(tooth.fdi)}, ${t(STATUS_A11Y[status])}` : toothName(tooth.fdi)}
            accessibilityHint={multiSelect ? t('arch.multiSelectOn') : undefined}
            accessibilityState={{ selected: selectedSet.has(tooth.fdi) }}
            accessibilityActions={[{ name: 'activate' }]}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'activate') onSelect(tooth.fdi);
            }}
            style={{
              position: 'absolute',
              left: tooth.x * scale - HIT_RADIUS_PT,
              top: tooth.y * scale - HIT_RADIUS_PT,
              width: HIT_RADIUS_PT * 2,
              height: HIT_RADIUS_PT * 2,
            }}
          />
        );
      })}
    </Animated.View>
  );
}

/** Small key for the status colors, shown under the chart. */
export function DentalArchLegend() {
  const item = (color: string, text: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 6 }}>
      <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: color, borderWidth: 1.5, borderColor: OUTLINE }} />
      <Text className="font-body-semi" style={{ fontSize: 13, color: tokens.textSecondary }}>
        {text}
      </Text>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', columnGap: 18 }}>
      {item(STATUS_FILL.symptom, t('arch.legendSymptom'))}
      {item(STATUS_FILL.treatment, t('arch.legendTreatment'))}
    </View>
  );
}
