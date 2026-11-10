// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// CAMERA GUARDRAIL (CLAUDE.md > Camera guardrail) — non-negotiable.
// Beavo's camera is a live mirror for a child (4–12) brushing their teeth. It must
// never capture, record, save, upload or analyze frames, and never use the mic.
// These rules fail lint on every API that would do so. Do not disable them
// inline; changing them needs the owner, the clinical advisor and a privacy-policy update.
const CAMERA_GUARDRAIL = 'Camera guardrail: the camera is a live mirror only — nothing is captured, recorded, saved, uploaded or analyzed (CLAUDE.md).';

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'dist-check/*', 'ios/*', 'android/*', 'public/*'],
  },
  {
    rules: {
      // A web-HTML rule: apostrophes in React Native <Text> render fine.
      'react/no-unescaped-entities': 'off',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'expo-media-library', message: CAMERA_GUARDRAIL },
            { name: 'expo-image-picker', message: CAMERA_GUARDRAIL },
            { name: 'expo-camera', message: `${CAMERA_GUARDRAIL} The mirror uses react-native-vision-camera's preview only.` },
            { name: 'react-native-worklets-core', message: CAMERA_GUARDRAIL },
            {
              name: 'react-native-vision-camera',
              importNames: [
                'usePhotoOutput',
                'useVideoOutput',
                'useFrameOutput',
                'useFrameRenderer',
                'useDepthOutput',
                'useObjectOutput',
                'useAsyncRunner',
                'useMicrophonePermission',
                'useCamera', // imperative controller; the mirror only needs <Camera>
                'useCameraSession',
                'VisionCamera', // factory object: createPhotoOutput, createFrameOutput, …
                'NativeFrameRendererView',
                'HybridFrameConverter',
                'VisionCameraWorkletsProxy',
              ],
              message: CAMERA_GUARDRAIL,
            },
          ],
          patterns: [
            { group: ['*frame-processor*', '*mediapipe*', 'react-native-vision-camera-*'], message: CAMERA_GUARDRAIL },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        ...[
          'capturePhoto',
          'capturePhotoToFile',
          'takePhoto',
          'takeSnapshot',
          'startRecording',
          'createRecorder',
          'takePictureAsync',
          'recordAsync',
          'createPhotoOutput',
          'createVideoOutput',
          'createFrameOutput',
          'createDepthFrameOutput',
          'createObjectOutput',
          'createOutput',
          'requestMicrophonePermission',
        ].map((property) => ({ property, message: CAMERA_GUARDRAIL })),
      ],
    },
  },
]);
