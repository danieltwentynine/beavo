/// <reference types="node" />
// App icons and native splash (beavo-design handoff; Expo SDK 57 field names).
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const app = JSON.parse(readFileSync(new URL('app.json', root), 'utf8')).expo as {
  ios: { icon: { light: string; dark: string; tinted: string } };
  android: { adaptiveIcon: { foregroundImage: string; backgroundColor: string; monochromeImage: string } };
  plugins: unknown[];
};

/** PNG width, height and whether it can carry alpha (IHDR colour type 4 or 6). */
function png(rel: string) {
  const b = readFileSync(new URL(rel.replace(/^\.\//, ''), root));
  assert.equal(b.toString('latin1', 1, 4), 'PNG', `${rel} is a PNG`);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), alpha: b[25] === 4 || b[25] === 6 };
}

test('iOS icons: light, dark and tinted, 1024×1024 and opaque (iOS applies the mask)', () => {
  for (const variant of ['light', 'dark', 'tinted'] as const) {
    const p = png(app.ios.icon[variant]);
    assert.deepEqual(p, { width: 1024, height: 1024, alpha: false }, variant);
  }
});

test('Android adaptive icon: foreground + monochrome 1024 px over primary teal', () => {
  const a = app.android.adaptiveIcon;
  assert.equal(a.backgroundColor, '#0A746E');
  for (const rel of [a.foregroundImage, a.monochromeImage]) {
    const p = png(rel);
    assert.equal(p.width, 1024, rel);
    assert.equal(p.height, 1024, rel);
  }
});

test('native splash: splash-logo on cream #FFF7EA at 300 pt, same image as the JS logo screen', () => {
  const plugin = app.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen') as [string, Record<string, unknown>];
  assert.ok(plugin, 'expo-splash-screen plugin');
  const opts = plugin[1];
  assert.equal(opts.backgroundColor, '#FFF7EA');
  assert.equal(opts.imageWidth, 300);
  assert.ok(existsSync(new URL(String(opts.image).replace(/^\.\//, ''), root)));
  const logoScreen = readFileSync(new URL('components/brand/LogoScreen.tsx', root), 'utf8');
  assert.ok(logoScreen.includes(String(opts.image).replace('./', '../../')), 'LogoScreen draws the same image');
});
