/// <reference types="node" />
// design/tokens.json is the source of truth: lib/tokens.ts and tailwind.preset.js are
// generated from it (scripts/build-tokens.mjs) and must never drift or be hand-edited.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (rel: string) => readFileSync(new URL(rel, root), 'utf8');

test('lib/tokens.ts and tailwind.preset.js are up to date with design/tokens.json', async () => {
  process.env.BUILD_TOKENS_CHECK = '1';
  const { outputs } = (await import(new URL('scripts/build-tokens.mjs', root).href)) as { outputs: Record<string, string> };
  for (const [file, text] of Object.entries(outputs)) {
    assert.equal(read(file), text, `${file} is stale or hand-edited: run node scripts/build-tokens.mjs`);
  }
});

test('every colour token in design/tokens.json reaches both outputs (kit + app-only tokens merged)', () => {
  const json = JSON.parse(read('design/tokens.json')) as { color: { tokens: { name: string }[] } };
  const names = json.color.tokens.map((t) => t.name);
  for (const required of ['ink', 'primary', 'session-accent', 'camera-scrim', 'session-pill', 'pause-veil', 'symptom', 'symptom-ink']) {
    assert.ok(names.includes(required), required);
  }
  const ts = read('lib/tokens.ts');
  const preset = read('tailwind.preset.js');
  for (const n of names) {
    const camel = n.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
    assert.ok(ts.includes(`"${camel}":`), `lib/tokens.ts colors.${camel}`);
    assert.ok(preset.includes(`"${n}":`), `preset ${n}`);
  }
});

test('every font in lib/tokens.ts is bundled and registered; the old font classes still resolve', () => {
  const ts = read('lib/tokens.ts');
  const fontBlock = ts.slice(ts.indexOf('export const fonts'), ts.indexOf('export const type'));
  const names = [...fontBlock.matchAll(/"(\w+)": "(\w+)"/g)].map((m) => [m[1], m[2]]);
  assert.equal(names.length, 5);
  const layout = read('app/_layout.tsx');
  const files: Record<string, string> = {
    display: 'Baloo2-Bold.ttf',
    displayExtraBold: 'Baloo2-ExtraBold.ttf',
    body: 'Nunito-Regular.ttf',
    bodySemiBold: 'Nunito-SemiBold.ttf',
    bodyBold: 'Nunito-Bold.ttf',
  };
  for (const [key] of names) {
    assert.ok(existsSync(new URL(`assets/fonts/${files[key]}`, root)), files[key]);
    assert.ok(layout.includes(`[fonts.${key}]: require('../assets/fonts/${files[key]}')`), `registered: ${key}`);
  }
  const preset = read('tailwind.preset.js');
  for (const cls of ['display', 'display-xb', 'body', 'body-semibold', 'body-bold', 'display-semi', 'numeric', 'body-semi']) {
    assert.match(preset, new RegExp(`"${cls}": \\[\\s*"(Baloo2|Nunito)_\\d00\\w+"`), `font-${cls}`);
  }
});

test('camera-session text and glyphs meet 4.5:1 on black and white frames', () => {
  type Rgb = [number, number, number];
  const json = JSON.parse(read('design/tokens.json')) as { color: { tokens: { name: string; value: { light: string } }[] } };
  const palette = new Map(json.color.tokens.map(({ name, value }) => [name, value.light]));
  function rgba(token: string): [Rgb, number] {
    const value = palette.get(token);
    assert.ok(value, token);
    if (value.startsWith('#')) {
      return [[1, 3, 5].map((index) => Number.parseInt(value.slice(index, index + 2), 16)) as Rgb, 1];
    }
    const [red, green, blue, alpha] = value.slice(5, -1).split(',').map(Number);
    return [[red, green, blue], alpha];
  }
  const overlay = (token: string, backdrop: Rgb) => {
    const [color, alpha] = rgba(token);
    return color.map((channel, index) => channel * alpha + backdrop[index] * (1 - alpha)) as Rgb;
  };
  const luminance = (rgb: Rgb) => rgb.reduce((sum, value, index) => {
    const srgb = value / 255;
    const linear = srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
  const contrast = (token: string, background: Rgb, label: string) => {
    const levels = [luminance(rgba(token)[0]), luminance(background)];
    const ratio = (Math.max(...levels) + 0.05) / (Math.min(...levels) + 0.05);
    assert.ok(ratio >= 4.5, `${label}: ${ratio.toFixed(2)}:1`);
  };

  for (const channel of [0, 255]) {
    const frame: Rgb = [channel, channel, channel];
    const mirror = overlay('camera-scrim', frame);
    // Native glass can remap the camera pixels. Check both the raw extrema
    // and the composited mirror so contrast does not depend on the material.
    for (const backdrop of [frame, mirror]) {
      contrast('ink', overlay('session-pill', backdrop), 'instructions, side labels, clock and coach body');
      contrast('primary-press', overlay('session-pill', backdrop), 'countdown, ring outline and coach heading');
      contrast('camera-control-ink', overlay('glass-session', backdrop), 'close/pause');
    }
    contrast('on-camera', overlay('camera-status-scrim', mirror), 'status bar');
  }
  contrast('primary-press', rgba('session-track')[0], 'running timer arc against the track');
  contrast('ink', rgba('zone-empty')[0], 'empty zone outline');
  contrast('session-accent', rgba('zone-active')[0], 'active zone glyph');
  contrast('on-primary', rgba('session-accent')[0], 'completed zone check');
  contrast('primary-soft', rgba('session-accent')[0], 'light foam over the completed zone before it fades');
  contrast('on-primary', rgba('primary')[0], 'coach score chip');
  contrast('ink', rgba('surface')[0], 'finish button text');
  contrast('on-warning', rgba('warning')[0], 'retry glyph');
  contrast('on-reward', rgba('reward')[0], 'cheer text');
});
