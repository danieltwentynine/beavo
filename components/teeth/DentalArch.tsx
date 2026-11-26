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
import Svg, { Circle, G, Path } from 'react-native-svg';

import { BeavoPoint } from '@/components/brand/BeavoBrand';
import { toothName } from '@/components/teeth/toothName';
import { SideLabels } from '@/components/ui/SideLabels';
import { t } from '@/lib/i18n';
import { colors, fonts } from '@/lib/tokens';
import {
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
const CENTER_SIDE_INSET = 0.18;
const CENTER_ART_WIDTH = 42;
const CENTER_GAP = 4;
const CENTER_CLEARANCE = 16;

const STATUS_FILL: Record<ToothStatus, string> = {
  symptom: colors.symptom,
  treatment: colors.primary,
  both: colors.symptom,
};
const BASE_FILL = colors.surface;
const OUTLINE = colors.toothLine;
const OUTLINE_SELECTED = colors.primaryPress;

const STATUS_OUTLINE: Record<ToothStatus, string> = {
  symptom: colors.symptomInk,
  treatment: colors.primaryPress,
  both: colors.primaryPress,
};

function StatusGlyph({ status }: { status: ToothStatus }) {
  if (status === 'symptom') return <Circle r={3.5} fill={colors.onSymptom} />;
  return (
    <Path d="M-4.5 0 l3 3 l6-6.5" stroke={status === 'both' ? colors.onSymptom : colors.onPrimary}
      fill="none" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  );
}

export function ToothStatusSwatch({ status }: { status?: ToothStatus }) {
  const fill = status ? STATUS_FILL[status] : BASE_FILL;
  const outline = status ? STATUS_OUTLINE[status] : OUTLINE;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ width: 18, height: 18, borderRadius: 5, borderWidth: status === 'both' ? 3 : 2,
        borderColor: outline, backgroundColor: fill, alignItems: 'center', justifyContent: 'center' }}>
      {status ? (
        <Svg width={14} height={14} viewBox="-8.75 -8.75 17.5 17.5">
          <StatusGlyph status={status} />
        </Svg>
      ) : null}
    </View>
  );
}

const AnimatedG = Animated.createAnimatedComponent(G);
const LAYOUT = layoutArch(CHART_PERSPECTIVE);

const GUM_PATHS = [LAYOUT.slice(0, 10), LAYOUT.slice(10)].map((arch, index) => {
  const first = arch[0];
  const last = arch[arch.length - 1];
  return `M${first.x} ${first.y} A125 135 0 0 ${index === 0 ? 1 : 0} ${last.x} ${last.y}`;
});

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
      {/* Soft glow: a wide translucent halo. */}
      {selected ? <Path d={d} fill="none" stroke={colors.primary} strokeWidth={9} strokeOpacity={0.28} /> : null}
      <Path
        d={d}
        fill={fill}
        stroke={selected ? OUTLINE_SELECTED : status ? STATUS_OUTLINE[status] : OUTLINE}
        strokeWidth={status === 'both' ? 3 : selected ? 2.5 : 2}
      />
      {groove ? (
        <Path d={groove} stroke={status ? colors.onPrimary : OUTLINE} strokeOpacity={status ? 0.35 : 0.4} strokeWidth={1.5} strokeLinecap="round" />
      ) : null}
      {status ? <G rotation={-tooth.rotation}><StatusGlyph status={status} /></G> : null}
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
  const centerPillMaxWidth = size * (1 - 2 * CENTER_SIDE_INSET) - CENTER_ART_WIDTH - CENTER_GAP - CENTER_CLEARANCE;
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

  const prompt = t('arch.pick');
  const selectionLabel = selected.length === 0 ? null
    : selected.length === 1 ? toothName(selected[0])
    : t('arch.selectedCount', { count: selected.length });

  const sideLabels = childRightOnViewerLeft(CHART_PERSPECTIVE)
    ? [t('arch.childRight'), t('arch.childLeft')]
    : [t('arch.childLeft'), t('arch.childRight')];

  const label = (text: string) => (
    <Text className="font-body-semi" style={{ fontSize: 16, color: colors.inkMuted }}>
      {text}
    </Text>
  );

  return (
    <>
      <Animated.View style={[{ width: size, height }, containerStyle]}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
          <Svg width={size} height={height} viewBox={`0 0 ${ARCH_VIEWBOX.width} ${ARCH_VIEWBOX.height}`}>
            {GUM_PATHS.map((d) => <Path key={d} d={d} fill="none" stroke={colors.chartGum} strokeWidth={49} strokeLinecap="round" />)}
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
        </View>

        {/* The short prompt stays inside the arch. The selection is read below. */}
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: size * CENTER_SIDE_INSET, right: size * CENTER_SIDE_INSET,
            top: 0, bottom: 0, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', columnGap: CENTER_GAP }}
        >
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <BeavoPoint width={CENTER_ART_WIDTH} accessible={false} />
          </View>
          <Text
            accessibilityLabel={prompt}
            accessibilityElementsHidden={selectionLabel !== null}
            importantForAccessibility={selectionLabel === null ? 'auto' : 'no-hide-descendants'}
            style={{ maxWidth: centerPillMaxWidth, flexShrink: 1, fontFamily: fonts.display, fontSize: 16, color: colors.onPrimary, textAlign: 'center',
              backgroundColor: colors.primary, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 6 }}
          >
            {prompt}
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
      {selectionLabel !== null ? (
        <Text accessibilityLiveRegion="polite" accessibilityLabel={selectionLabel} className="font-display"
          style={{ marginTop: 8, width: size, fontSize: 16, lineHeight: 22, color: colors.ink, textAlign: 'center' }}>
          {selectionLabel}
        </Text>
      ) : null}
      <SideLabels left={sideLabels[0]} right={sideLabels[1]} width={size} />
      <Text className="font-body" style={{ marginTop: 8, fontSize: 16, color: colors.inkMuted, textAlign: 'center' }}>
        {t('arch.perspective')}
      </Text>
    </>
  );
}

/** The four chart appearances, each paired with its label. */
export function DentalArchLegend() {
  const entries = [
    [undefined, 'arch.legendNone'],
    ['symptom', 'arch.legendSymptom'],
    ['treatment', 'arch.legendTreatment'],
    ['both', 'arch.legendBoth'],
  ] as const;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
      {entries.map(([status, key]) => (
        <View key={key} style={{ width: '48%', minHeight: 44, flexDirection: 'row', alignItems: 'center', columnGap: 6, backgroundColor: colors.surfaceWarm, borderRadius: 22, paddingHorizontal: 8, paddingVertical: 6 }}>
          <ToothStatusSwatch status={status} />
          <Text className="font-body-semi" style={{ flexShrink: 1, fontSize: 16, color: colors.inkMuted }}>{t(key)}</Text>
        </View>
      ))}
    </View>
  );
}
