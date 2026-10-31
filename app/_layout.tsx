import '../global.css';

import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useChildDataSync } from '@/hooks/useChildDataSync';
import { checkConsent } from '@/lib/consent';
import { auth } from '@/lib/firebase';
import { flushOutbox } from '@/lib/sync';
import { tokens } from '@/lib/tokens';
import { useAuthStore } from '@/stores/authStore';
import { clearSnapshot } from '@/stores/childStore';

export default function RootLayout() {
  const setUser = useAuthStore((state) => state.setUser);
  const setConsent = useAuthStore((state) => state.setConsent);
  const uid = useAuthStore((state) => state.user?.uid ?? null);
  useChildDataSync(uid);
  const lastUid = useRef<string | null>(null);

  // Static weights: the family name picks the weight (see font in lib/tokens.ts).
  const [fontsLoaded] = useFonts({
    'Fredoka-Medium': require('../assets/fonts/Fredoka-Medium.ttf'),
    'Fredoka-SemiBold': require('../assets/fonts/Fredoka-SemiBold.ttf'),
    'Fredoka-Bold': require('../assets/fonts/Fredoka-Bold.ttf'),
    'Lexend-Regular': require('../assets/fonts/Lexend-Regular.ttf'),
    'Lexend-SemiBold': require('../assets/fonts/Lexend-SemiBold.ttf'),
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      // Any end of session (sign-out here, or deleted/disabled elsewhere): drop
      // the previous parent's child names from this device.
      if (!user && lastUid.current) void clearSnapshot(lastUid.current);
      lastUid.current = user?.uid ?? null;
      if (!user) return;
      // Sessions saved offline in an earlier run: retried once we know which
      // parent is signed in, since the security rules are scoped to them.
      void flushOutbox(user.uid);
      void checkConsent(user.uid).then((status) => {
        if (useAuthStore.getState().user?.uid === user.uid) setConsent(status);
      });
    });
    return unsubscribe;
  }, [setUser, setConsent]);

  // Back in the foreground (often back online too): retry unconfirmed sessions.
  useEffect(() => {
    if (!uid) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void flushOutbox(uid);
    });
    return () => sub.remove();
  }, [uid]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tokens.surfacePage },
        }}
      >
        <Stack.Screen
          name="child-picker"
          options={{ presentation: 'formSheet', sheetAllowedDetents: [0.5, 1], sheetGrabberVisible: true }}
        />
      </Stack>
    </>
  );
}
