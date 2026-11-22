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

import { toothName } from '@/components/teeth/toothName';
import { SideLabels } from '@/components/ui/SideLabels';
import { t } from '@/lib/i18n';
import { font, tokens } from '@/lib/tokens';
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
  symptom: tokens.symptom,
  treatment: tokens.brandPrimary,
  both: tokens.symptom,
};
const BASE_FILL = tokens.surfaceCard;
const OUTLINE = tokens.zoneLine;
const OUTLINE_SELECTED = tokens.brandPrimaryPress;

const STATUS_OUTLINE: Record<ToothStatus, string> = {
  symptom: tokens.symptomInk,
  treatment: tokens.brandPrimaryPress,
  both: tokens.brandPrimaryPress,
};

function StatusGlyph({ status }: { status: ToothStatus }) {
  if (status === 'symptom') return <Circle r={3.5} fill={tokens.onSymptom} />;
  return (
    <Path d="M-4.5 0 l3 3 l6-6.5" stroke={status === 'both' ? tokens.onSymptom : tokens.textOnBrand}
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
      {selected ? <Path d={d} fill="none" stroke={tokens.brandPrimary} strokeWidth={9} strokeOpacity={0.28} /> : null}
      <Path
        d={d}
        fill={fill}
        stroke={selected ? OUTLINE_SELECTED : status ? STATUS_OUTLINE[status] : OUTLINE}
        strokeWidth={status === 'both' ? 3 : selected ? 2.5 : 2}
      />
      {groove ? (
        <Path d={groove} stroke={status ? tokens.textOnBrand : OUTLINE} strokeOpacity={status ? 0.35 : 0.4} strokeWidth={1.5} strokeLinecap="round" />
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
    <Text className="font-body-semi" style={{ fontSize: 16, color: tokens.textSecondary }}>
      {text}
    </Text>
  );

  return (
    <>
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
            style={{ fontFamily: font.display, fontSize: 17, color: tokens.textPrimary, textAlign: 'center' }}
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
      <SideLabels left={sideLabels[0]} right={sideLabels[1]} width={size} />
      <Text className="font-body" style={{ marginTop: 8, fontSize: 16, color: tokens.textSecondary, textAlign: 'center' }}>
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
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 18, rowGap: 8 }}>
      {entries.map(([status, key]) => (
        <View key={key} style={{ width: '45%', flexDirection: 'row', alignItems: 'center', columnGap: 6 }}>
          <ToothStatusSwatch status={status} />
          <Text className="font-body-semi" style={{ flexShrink: 1, fontSize: 16, color: tokens.textSecondary }}>{t(key)}</Text>
        </View>
      ))}
    </View>
  );
}
