import '../global.css';

import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { LogoScreen } from '@/components/brand/LogoScreen';
import { useChildDataSync } from '@/hooks/useChildDataSync';
import { cleanupBackupFiles } from '@/lib/account';
import { checkConsent } from '@/lib/consent';
import { auth } from '@/lib/firebase';
import { flushOutbox } from '@/lib/sync';
import { tokens } from '@/lib/tokens';
import { useAuthStore } from '@/stores/authStore';
import { clearSnapshot } from '@/stores/childStore';
import { useSettingsStore } from '@/stores/settingsStore';

// The native splash stays up until the logo screen has drawn the same image in the same spot.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [logoDone, setLogoDone] = useState(false);
  const hideLogo = useCallback(() => setLogoDone(true), []);
  const setUser = useAuthStore((state) => state.setUser);
  const setConsent = useAuthStore((state) => state.setConsent);
  const loadSettings = useSettingsStore((state) => state.load);
  useEffect(() => {
    void loadSettings();
    cleanupBackupFiles();
  }, [loadSettings]);
  const uid = useAuthStore((state) => state.user?.uid ?? null);
  useChildDataSync(uid);
  const lastUid = useRef<string | null>(null);

  // Static weights: the family name picks the weight (see font in lib/tokens.ts).
  const [fontsLoaded] = useFonts({
    'Baloo2-ExtraBold': require('../assets/fonts/Baloo2-ExtraBold.ttf'),
    'Baloo2-Bold': require('../assets/fonts/Baloo2-Bold.ttf'),
    'Nunito-Regular': require('../assets/fonts/Nunito-Regular.ttf'),
    'Nunito-SemiBold': require('../assets/fonts/Nunito-SemiBold.ttf'),
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
          options={{ presentation: 'formSheet', sheetAllowedDetents: [0.5, 1], sheetGrabberVisible: true, contentStyle: { backgroundColor: 'transparent' } }}
        />
        <Stack.Screen
          name="tooth-sheet"
          options={{ presentation: 'formSheet', sheetAllowedDetents: [0.6, 1], sheetGrabberVisible: true, contentStyle: { backgroundColor: 'transparent' } }}
        />
      </Stack>
      {logoDone ? null : <LogoScreen onDone={hideLogo} />}
    </>
  );
}
