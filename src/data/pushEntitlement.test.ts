/// <reference types="node" />
// Reminders are LOCAL notifications only: no APNs entitlement, so iOS can never
// hand the app a push token (plugins/withoutPushEntitlement.js). The full
// check is `npx expo config --type introspect` → ios.entitlements is {} (run
// for the build report); these tests pin the pieces that make it so.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const app = JSON.parse(readFileSync(new URL('../../app.json', import.meta.url), 'utf8')).expo;
const pluginName = (p: unknown) => (Array.isArray(p) ? p[0] : p);

test('app.json: expo-notifications is local-only and the entitlement remover runs after it', () => {
  const names: string[] = app.plugins.map(pluginName);
  const remover = names.indexOf('./plugins/withoutPushEntitlement');
  const notifications = names.indexOf('expo-notifications');
  assert.ok(notifications >= 0 && remover >= 0);
  // Mods run in reverse plugin order: listed BEFORE means it runs AFTER.
  assert.ok(remover < notifications, 'withoutPushEntitlement must be listed before expo-notifications');
  const options = app.plugins[notifications][1];
  assert.equal(options.enableRemoteNotifications, false);
  assert.equal(options.enableBackgroundRemoteNotifications, false);
  assert.equal(app.ios.entitlements?.['aps-environment'], undefined);
  assert.ok(!(app.ios.infoPlist?.UIBackgroundModes ?? []).includes('remote-notification'));
});

test('the plugin removes aps-environment and keeps every other entitlement', async () => {
  const plugin = require('../../plugins/withoutPushEntitlement.js');
  const mod = plugin({ name: 'beavo', slug: 'beavo' }).mods.ios.entitlements;
  const result = await mod({ modResults: { 'aps-environment': 'development', 'keychain-access-groups': ['x'] }, modRequest: { nextMod: async (c: unknown) => c } });
  assert.deepEqual(result.modResults, { 'keychain-access-groups': ['x'] });
});

test('no push-token API is called anywhere in the app', () => {
  const root = new URL('../../', import.meta.url);
  for (const dir of ['app', 'components', 'hooks', 'lib', 'stores', 'src']) {
    for (const file of readdirSync(new URL(dir, root), { recursive: true }) as string[]) {
      if (!/\.tsx?$/.test(file) || file.endsWith('.test.ts')) continue;
      const source = readFileSync(new URL(`${dir}/${file}`, root), 'utf8');
      assert.ok(!/get(Expo|Device)PushTokenAsync|addPushTokenListener/.test(source), `${dir}/${file}`);
    }
  }
});
