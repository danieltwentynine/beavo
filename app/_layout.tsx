import '../global.css';

import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect } from 'react';

import { auth } from '@/lib/firebase';
import { isLocalMode } from '@/lib/localStore';
import { flushOutbox } from '@/lib/sessions';
import { tokens } from '@/lib/tokens';
import { useAuthStore } from '@/stores/authStore';

export default function RootLayout() {
  const setUser = useAuthStore((state) => state.setUser);
  const setLocal = useAuthStore((state) => state.setLocal);

  // Static weights: the family name picks the weight (see font in lib/tokens.ts).
  const [fontsLoaded] = useFonts({
    'Fredoka-Medium': require('../assets/fonts/Fredoka-Medium.ttf'),
    'Fredoka-SemiBold': require('../assets/fonts/Fredoka-SemiBold.ttf'),
    'Fredoka-Bold': require('../assets/fonts/Fredoka-Bold.ttf'),
    'Lexend-Regular': require('../assets/fonts/Lexend-Regular.ttf'),
    'Lexend-SemiBold': require('../assets/fonts/Lexend-SemiBold.ttf'),
  });

  useEffect(() => {
    void isLocalMode().then(setLocal);
  }, [setLocal]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      // Sessions saved offline in an earlier run: retried once we know which
      // parent is signed in, since the security rules are scoped to them.
      if (user) void flushOutbox(user.uid);
    });
    return unsubscribe;
  }, [setUser]);

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
      />
    </>
  );
}
