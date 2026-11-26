import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, type CameraDevice } from 'react-native-vision-camera';

import { colors } from '@/lib/tokens';

/**
 * Live front-camera MIRROR behind the session UI — see CLAUDE.md > Camera
 * guardrail. Preview only: no photo, video, frame or audio output is attached,
 * so nothing is captured, recorded, saved, uploaded or analyzed. ESLint
 * (eslint.config.js) fails the build on the APIs that would change that.
 *
 * The camera runs only while this screen is focused and the app is in the
 * foreground; otherwise `isActive` is false and the session is released.
 * The session mounts this only when a front camera is available.
 */
export function CameraBackdrop({ device }: { device: CameraDevice }) {
  const focused = useIsFocused();
  const { top } = useSafeAreaInsets();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => sub.remove();
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={focused && foreground}
        resizeMode="cover"
        orientationSource="interface"
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.cameraScrim }]} />
      {top > 0 ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: top, backgroundColor: colors.cameraStatusScrim }} />
      ) : null}
    </View>
  );
}
