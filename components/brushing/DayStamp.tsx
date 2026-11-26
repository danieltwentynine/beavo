import { Leaf, PawPrint, Sparkle } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import Animated, { Easing, Keyframe, useReducedMotion } from 'react-native-reanimated';

import { t } from '@/lib/i18n';
import { colors, radius } from '@/lib/tokens';

const sparkleReveal = new Keyframe({
  from: { opacity: 0, transform: [{ scale: 0.82 }] },
  45: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.out(Easing.quad) },
  to: { opacity: 0, transform: [{ scale: 1.08 }] },
}).duration(320);

const stampReveal = new Keyframe({
  from: { opacity: 0, transform: [{ scale: 0.94 }] },
  to: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.out(Easing.quad) },
}).delay(160).duration(180);

const flipIn = new Keyframe({
  from: { transform: [{ scaleX: 0.2 }] },
  to: { transform: [{ scaleX: 1 }], easing: Easing.out(Easing.quad) },
}).duration(170);

export function DayStamp() {
  const reduceMotion = useReducedMotion();
  const [reveal, setReveal] = useState(AppState.currentState === 'active');
  const [face, setFace] = useState<'leaf' | 'paw'>('leaf');
  const [hasFlipped, setHasFlipped] = useState(false);
  const FaceIcon = face === 'leaf' ? Leaf : PawPrint;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') setReveal(false);
    });
    return () => subscription.remove();
  }, []);

  return (
    <View style={{ width: '100%', alignItems: 'center', rowGap: 4, marginTop: 16 }}>
      <Text className="font-body-semi" style={{ fontSize: 16, color: colors.ink, textAlign: 'center' }}>
        {t('results.glow')}
      </Text>
      <Text className="font-display" style={{ fontSize: 20, color: colors.ink, textAlign: 'center' }}>
        {t('results.stampTitle')}
      </Text>
      <View style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
        {reveal && !reduceMotion && !hasFlipped ? (
          <Animated.View
            entering={sparkleReveal}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ position: 'absolute', zIndex: 1 }}
          >
            <Sparkle size={30} weight="duotone" color={colors.reward} />
          </Animated.View>
        ) : null}
        <Animated.View entering={reveal && !reduceMotion ? stampReveal : undefined}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('results.stampTitle') + ', ' + t(`results.stampFace.${face}`)}
            accessibilityHint={t('results.stampHint')}
            onPress={() => {
              setHasFlipped(true);
              setFace((current) => current === 'leaf' ? 'paw' : 'leaf');
            }}
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.pill,
              backgroundColor: colors.primarySoft,
              borderWidth: 2,
              borderColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Animated.View
              key={face}
              entering={hasFlipped && !reduceMotion ? flipIn : undefined}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <FaceIcon size={32} weight="duotone" color={colors.primaryPress} />
            </Animated.View>
          </Pressable>
        </Animated.View>
      </View>
      <Text className="font-body" style={{ fontSize: 16, color: colors.inkMuted, textAlign: 'center' }}>
        {t('results.stamp')}
      </Text>
    </View>
  );
}
