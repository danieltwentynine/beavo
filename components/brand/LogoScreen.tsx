import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { t } from '@/lib/i18n';
import { colors, motion } from '@/lib/tokens';

/** Same image, size and spot as the native splash (app.json: imageWidth 300), so the hand-off is invisible. */
const LOGO_SIZE = 300;

/**
 * The 1-second logo screen, drawn over the app once per launch: the logo
 * breathes once, the tagline fades in, then it cross-fades into whatever
 * screen the router chose underneath. Reduce Motion: opacity only.
 */
export function LogoScreen({ onDone }: { onDone: () => void }) {
  const reduceMotion = useReducedMotion();
  const [imageReady, setImageReady] = useState(false);
  const scale = useSharedValue(1);
  const tagline = useSharedValue(0);
  const screen = useSharedValue(1);

  useEffect(() => {
    if (!imageReady) return;
    SplashScreen.hide();
    if (!reduceMotion) {
      const ease = Easing.bezier(0.2, 0.8, 0.2, 1);
      scale.value = withSequence(withTiming(1.05, { duration: 300, easing: ease }), withTiming(1, { duration: 300, easing: ease }));
    }
    tagline.value = withDelay(300, withTiming(1, { duration: 300, reduceMotion: ReduceMotion.Never }), ReduceMotion.Never);
    screen.value = withDelay(motion.logoScreenHold, withTiming(0, {
      duration: motion.logoScreenFade,
      reduceMotion: ReduceMotion.Never,
    }), ReduceMotion.Never);
    const timer = setTimeout(onDone, motion.logoScreenHold + motion.logoScreenFade);
    return () => clearTimeout(timer);
  }, [imageReady, onDone, reduceMotion, scale, tagline, screen]);

  const screenStyle = useAnimatedStyle(() => ({ opacity: screen.value }));
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: tagline.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - tagline.value) * 6 }],
  }));

  return (
    <Animated.View
      accessible
      accessibilityViewIsModal
      accessibilityRole="image"
      accessibilityLabel={`Beavo. ${t('brand.tagline')}`}
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }, screenStyle]}
    >
      <Animated.View style={logoStyle}>
        <Image onLoadEnd={() => setImageReady(true)} source={require('../../assets/splash-icon.png')} style={{ width: LOGO_SIZE, height: LOGO_SIZE }} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', top: '50%', left: 0, right: 0, marginTop: 96, alignItems: 'center' }, taglineStyle]}>
        <Text className="font-body-semi" style={{ fontSize: 18, color: colors.inkMuted }}>
          {t('brand.tagline')}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}
