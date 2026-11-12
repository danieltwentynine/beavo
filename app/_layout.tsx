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
import { isLocalMode, startLocalStore } from '@/lib/localData';
import { checkConsent } from '@/lib/consent';
import { auth } from '@/lib/firebase';
import { flushOutbox } from '@/lib/sync';
import { tokens } from '@/lib/tokens';
import { ownerIdOf, useAuthStore } from '@/stores/authStore';
import { clearSnapshot } from '@/stores/childStore';
import { useSettingsStore } from '@/stores/settingsStore';

// The native splash stays up until the logo screen has drawn the same image in the same spot.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [logoDone, setLogoDone] = useState(false);
  const hideLogo = useCallback(() => setLogoDone(true), []);
  const setUser = useAuthStore((state) => state.setUser);
  const setConsent = useAuthStore((state) => state.setConsent);
  const setLocal = useAuthStore((state) => state.setLocal);
  const loadSettings = useSettingsStore((state) => state.load);
  useEffect(() => {
    void loadSettings();
    cleanupBackupFiles();
    // Device-only mode (ADR 0005): the data kept on this phone, and whether it is in use.
    void startLocalStore();
    void isLocalMode().then(setLocal);
  }, [loadSettings, setLocal]);
  // The signed-in parent, or this device when Beavo is used without an account.
  const uid = useAuthStore((state) => (state.isLoading ? null : ownerIdOf(state)));
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
    });
    return unsubscribe;
  }, [setUser]);

  useEffect(() => {
    if (!uid) return;
    let stale = false;
    // Sessions saved offline in an earlier run: retried once we know whose they
    // are, since the security rules are scoped to the signed-in parent.
    void flushOutbox(uid);
    void checkConsent(uid).then((status) => {
      if (!stale) setConsent(status);
    });
    return () => {
      stale = true;
    };
  }, [uid, setConsent]);

  // Back in the foreground (often back online too): retry unconfirmed sessions,
  // and reading the device data if storage wasn't available at launch.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void startLocalStore();
      if (uid) void flushOutbox(uid);
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
