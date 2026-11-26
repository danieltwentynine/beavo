import { Play } from 'phosphor-react-native';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, Keyframe, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BeavoMark } from '@/components/brand/BeavoBrand';
import { formatBrushTime } from '@/components/brushing/BrushTimer';
import { Button } from '@/components/ui/Button';
import { t } from '@/lib/i18n';
import { colors, radius, shadow } from '@/lib/tokens';

const ease = Easing.bezier(0.2, 0.8, 0.2, 1);
const fadeIn = FadeIn.duration(200).reduceMotion(ReduceMotion.Never);
const fadeOut = FadeOut.duration(200).reduceMotion(ReduceMotion.Never);
const cardIn = new Keyframe({
  from: { opacity: 0, transform: [{ scale: 0.96 }] },
  to: { opacity: 1, transform: [{ scale: 1 }], easing: ease },
}).duration(300);
const cardOut = new Keyframe({
  from: { opacity: 1, transform: [{ scale: 1 }] },
  to: { opacity: 0, transform: [{ scale: 0.96 }], easing: ease },
}).duration(200);

export function SessionPauseCard({ remaining, canSave, reduceMotion, onResume, onEnd }: {
  remaining: number;
  canSave: boolean;
  reduceMotion: boolean;
  onResume: () => void;
  onEnd: () => void;
}) {
  const title = useRef<Text>(null);
  const heading = t('session.pausedTitle');

  useEffect(() => {
    let mounted = true;
    const announceAndFocus = () => {
      void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
        if (!mounted || !enabled || AppState.currentState !== 'active' || !title.current) return;
        AccessibilityInfo.announceForAccessibility(heading);
        AccessibilityInfo.sendAccessibilityEvent(title.current, 'focus');
      });
    };
    if (AppState.currentState === 'active') announceAndFocus();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') announceAndFocus();
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [heading]);

  return (
    <Animated.View entering={fadeIn} exiting={fadeOut}
      style={[StyleSheet.absoluteFill, { zIndex: 10, backgroundColor: colors.pauseVeil }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Animated.View accessibilityViewIsModal entering={reduceMotion ? fadeIn : cardIn} exiting={reduceMotion ? fadeOut : cardOut}
            style={{ width: '100%', maxWidth: 360, padding: 24, rowGap: 16, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadow.card }}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ alignSelf: 'center' }}>
              <BeavoMark width={72} />
            </View>
            <Text ref={title} accessibilityRole="header" className="font-display"
              style={{ fontSize: 28, lineHeight: 34, color: colors.ink, textAlign: 'center' }}>
              {heading}
            </Text>
            <Text className="font-body-semi" style={{ fontSize: 18, color: colors.inkMuted, textAlign: 'center' }}>
              {t('session.pausedLeft', { time: formatBrushTime(remaining) })}
            </Text>
            <Button size="lg" label={t('session.resume')} onPress={onResume}
              icon={<Play size={22} color={colors.onPrimary} weight="fill" />} />
            <Button variant="outline" label={t(canSave ? 'session.endSave' : 'session.stop')} onPress={onEnd} />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );
}
