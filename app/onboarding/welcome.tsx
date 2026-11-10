import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { SparkyWave, BeavoLockup } from '@/components/brand/BeavoBrand';
import { Button } from '@/components/ui/Button';
import { signInWithGoogle } from '@/lib/socialAuth';
import { tokens } from '@/lib/tokens';

/** Google's official four-colour "G". Unmodified — required for OAuth branding review. */
function GoogleG() {
  return (
    <Svg width={22} height={22} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65Z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19Z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
      />
    </Svg>
  );
}

/** Sparky drifts gently up and down so the welcome screen feels alive. */
function FloatingMascot({ width }: { width: number }) {
  const reduceMotion = useReducedMotion();
  const float = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    float.value = withRepeat(
      withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    return () => cancelAnimation(float);
  }, [float, reduceMotion]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value * -9 }],
  }));

  return (
    <Animated.View style={floatStyle}>
      <SparkyWave width={width} />
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  const [googlePending, setGooglePending] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const onGoogleSignIn = async () => {
    if (googlePending) return;
    setSignInError(null);
    setGooglePending(true);
    try {
      const result = await signInWithGoogle();
      if (result.status === 'cancelled') return;
      if (result.status === 'error') {
        setSignInError(result.message);
        return;
      }
      router.replace('/');
    } finally {
      setGooglePending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surfacePage }}>
      <SafeAreaView style={{ flex: 1, paddingHorizontal: 28, paddingBottom: 32 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', rowGap: 6 }}>
          <FloatingMascot width={200} />
          <View style={{ marginTop: 12 }}>
            <BeavoLockup height={56} />
          </View>
          <Text
            className="font-body"
            style={{
              fontSize: 18,
              lineHeight: 26,
              color: tokens.textSecondary,
              textAlign: 'center',
              maxWidth: 280,
              marginTop: 10,
            }}
          >
            The brushing buddy that turns two minutes into a daily adventure.
          </Text>
        </View>
        <View style={{ rowGap: 12, marginTop: 24 }}>
          {signInError ? (
            <Text
              className="font-body-semi text-sm text-danger"
              style={{ textAlign: 'center' }}
            >
              {signInError}
            </Text>
          ) : null}
          <Button label="Get started" size="lg" onPress={() => router.push('/(auth)/register')} />
          <Button
            label="Continue with Google"
            variant="outline"
            icon={<GoogleG />}
            loading={googlePending}
            onPress={onGoogleSignIn}
          />
          <Button
            label="I already have an account"
            variant="ghost"
            onPress={() => router.push('/(auth)/login')}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
