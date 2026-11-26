/// <reference types="node" />
// The Google Sign-In iOS callback scheme is derived from the iOS client id
// (plugins/withGoogleSignInScheme.js) at prebuild, never at config-read time.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { reversedClientIdScheme } = require('../../plugins/googleScheme.js') as { reversedClientIdScheme: (id: string | undefined) => string };
type InfoPlist = { CFBundleURLTypes?: { CFBundleURLSchemes: string[] }[] };
const plugin = require('../../plugins/withGoogleSignInScheme.js') as ((config: Record<string, unknown>) => Record<string, unknown>) & {
  applyGoogleScheme: (plist: InfoPlist, id: string | undefined) => InfoPlist;
};

const EXAMPLE = '111111111111-abcdefghijklmnop.apps.googleusercontent.com'; // example value, not a real client
const schemes = (plist: InfoPlist) => (plist.CFBundleURLTypes ?? []).flatMap((t) => t.CFBundleURLSchemes);

test('a valid client id gives the reversed scheme', () => {
  assert.equal(reversedClientIdScheme(EXAMPLE), 'com.googleusercontent.apps.111111111111-abcdefghijklmnop');
  assert.equal(reversedClientIdScheme('222222222222-0a1b2c3d4e5f6g7h8i9j.apps.googleusercontent.com'), 'com.googleusercontent.apps.222222222222-0a1b2c3d4e5f6g7h8i9j'); // example
});

test('a missing client id fails loudly, naming the variable', () => {
  for (const missing of [undefined, '', '   ']) {
    assert.throws(() => reversedClientIdScheme(missing), /EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is not set/);
  }
});

test('malformed client ids are refused (internal space, trailing whitespace, wrong suffix…), never echoing the value', () => {
  const id = '111111111111-abcdefghijklmnop';
  const bad = [
    `${id.slice(0, 12)} ${id.slice(12)}.apps.googleusercontent.com`, // internal space
    `${id}.apps.googleusercontent.com `, // trailing space
    `${id}.apps.googleusercontent.com\n`, // trailing newline
    ` ${id}.apps.googleusercontent.com`, // leading space
    `${id}.apps.googleusercontent.co`, // wrong suffix
    `${id}.apps.example.com`, // wrong suffix
    '.apps.googleusercontent.com', // no id
    'abcdef-123.apps.googleusercontent.com', // no project number
    '111111111111-ABCdef.apps.googleusercontent.com', // uppercase
    '111111111111.apps.googleusercontent.com', // no client part
    `${id}.apps.googleusercontent.com/x`, // extra path
  ];
  for (const value of bad) {
    assert.throws(
      () => reversedClientIdScheme(value),
      (error: Error) => /EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is not a valid Google iOS OAuth client id/.test(error.message) && !error.message.includes(id.slice(0, 12)),
      JSON.stringify(value),
    );
  }
});

test('prebuild never writes a scheme from a malformed id to Info.plist', () => {
  assert.throws(() => plugin.applyGoogleScheme({}, '111111111111-abc def.apps.googleusercontent.com'), /not a valid Google iOS OAuth client id/);
});

test('prebuild adds the derived scheme to Info.plist once, keeping the existing schemes', () => {
  const plist = plugin.applyGoogleScheme({ CFBundleURLTypes: [{ CFBundleURLSchemes: ['beavo'] }] }, EXAMPLE);
  assert.deepEqual(schemes(plist), ['beavo', reversedClientIdScheme(EXAMPLE)]);
  assert.deepEqual(schemes(plugin.applyGoogleScheme(plist, EXAMPLE)), schemes(plist), 'idempotent');
  assert.throws(() => plugin.applyGoogleScheme({}, undefined), /EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is not set/);
});

test('reading the config never needs the variable (eas init / EXPO_NO_DOTENV), and app.json hard-codes no scheme', () => {
  const previous = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  try {
    assert.doesNotThrow(() => plugin({ name: 'Beavo', slug: 'x', ios: {} }));
  } finally {
    if (previous !== undefined) process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = previous;
  }
  const appJson = readFileSync(new URL('../../app.json', import.meta.url), 'utf8');
  assert.ok(!appJson.includes('iosUrlScheme'));
  assert.ok(appJson.includes('./plugins/withGoogleSignInScheme'));
});
