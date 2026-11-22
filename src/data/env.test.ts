/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parsePublicEnv } from './env.ts';

const full = {
  EXPO_PUBLIC_FIREBASE_API_KEY: 'k',
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'd',
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'p',
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: 'b',
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: 's',
  EXPO_PUBLIC_FIREBASE_APP_ID: 'a',
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'w',
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: 'i',
};

test('a complete config passes', () => {
  assert.equal(parsePublicEnv(full).EXPO_PUBLIC_FIREBASE_PROJECT_ID, 'p');
});

test('missing or blank keys are named, values never appear', () => {
  assert.throws(
    () => parsePublicEnv({ ...full, EXPO_PUBLIC_FIREBASE_API_KEY: undefined, EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: '  ', EXPO_PUBLIC_FIREBASE_APP_ID: 'secret-value' }),
    (error: Error) =>
      error.message.includes('EXPO_PUBLIC_FIREBASE_API_KEY') &&
      error.message.includes('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID') &&
      !error.message.includes('EXPO_PUBLIC_FIREBASE_APP_ID') &&
      !error.message.includes('secret-value'),
  );
});
