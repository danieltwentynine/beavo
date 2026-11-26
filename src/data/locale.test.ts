/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { pickLocale } from './locale.ts';

test('forced pt-BR: an English (or Spanish, or unknown) device still gets pt-BR', () => {
  for (const device of ['en', 'es', 'pt', 'fr', null, undefined]) assert.equal(pickLocale(device, 'pt-BR'), 'pt-BR');
});

test('not forced: English and Spanish devices get their language, everything else pt-BR', () => {
  assert.equal(pickLocale('en', null), 'en');
  assert.equal(pickLocale('es', null), 'es');
  assert.equal(pickLocale('pt', null), 'pt-BR');
  assert.equal(pickLocale(undefined, null), 'pt-BR');
});

test("this branch forces pt-BR in lib/i18n.ts, and iOS permission texts ship only in pt-BR", () => {
  const i18n = readFileSync(new URL('../../lib/i18n.ts', import.meta.url), 'utf8');
  assert.match(i18n, /const FORCED_LOCALE: Locale \| null = 'pt-BR';/);
  const app = JSON.parse(readFileSync(new URL('../../app.json', import.meta.url), 'utf8')) as {
    expo: { locales: Record<string, string>; ios: { infoPlist: Record<string, string> } };
  };
  assert.deepEqual(Object.keys(app.expo.locales), ['pt-BR']);
  assert.equal(app.expo.ios.infoPlist.CFBundleDevelopmentRegion, 'pt-BR');
  assert.match(app.expo.ios.infoPlist.NSCameraUsageDescription, /câmera/);
});
