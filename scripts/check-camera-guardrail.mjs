// Camera guardrail check — run: node scripts/check-camera-guardrail.mjs (CI runs it).
// The camera is a live MIRROR only (CLAUDE.md > Camera guardrail). ESLint catches
// capture/record calls in code; this catches what ESLint can't see: a microphone
// permission in the app config, or a capture / frame-processing package installed.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const configFiles = ['app.json', ...readdirSync(new URL('../locales', import.meta.url)).map((f) => `locales/${f}`)];
for (const file of configFiles) {
  assert.ok(!read(file).includes('NSMicrophoneUsageDescription'), `${file}: no microphone permission — the mirror needs no audio`);
  assert.ok(!/enableMicrophonePermission"\s*:\s*true/.test(read(file)), `${file}: microphone permission must stay off`);
}

// Android: libraries can merge permissions into the build, so the microphone is blocked, not just left out.
const android = JSON.parse(read('app.json')).expo.android ?? {};
const MIC = 'android.permission.RECORD_AUDIO';
assert.deepEqual(android.permissions, ['android.permission.CAMERA'], 'app.json: android.permissions must be the camera only');
assert.ok((android.blockedPermissions ?? []).includes(MIC), `app.json: android.blockedPermissions must include ${MIC}`);
// Device-only data must not reach Google's cloud backup (ADR 0005, ADR 0006).
assert.equal(android.allowBackup, false, 'app.json: android.allowBackup must stay false');

const pkg = JSON.parse(read('package.json'));
const installed = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
const banned = [
  /^expo-media-library$/, // saving photos/videos
  /^expo-image-picker$/, // can capture from the camera
  /^expo-camera$/, // second camera stack with takePictureAsync/recordAsync
  /^react-native-worklets-core$/, // VisionCamera frame processors
  /frame-processor/,
  /mediapipe/,
  /vision-camera-.+/, // VisionCamera plugins (face detector, OCR, …)
];
for (const name of installed) {
  const rule = banned.find((re) => re.test(name));
  assert.ok(!rule, `package.json: "${name}" is banned by the camera guardrail (${rule})`);
}

console.log(`camera guardrail ok (${configFiles.length} config files, ${installed.length} packages)`);
