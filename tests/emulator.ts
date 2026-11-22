/// <reference types="node" />
// Shared Firestore-emulator setup for tests/*.test.ts. Run via `npm run test:emulator`
// (firebase emulators:exec sets FIRESTORE_EMULATOR_HOST).
import { readFileSync } from 'node:fs';

import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import type { Firestore } from 'firebase/firestore';

export function startEmulator(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: 'demo-beavo',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
}

/**
 * A Firestore signed in as `uid`, with the real rules enforced. The test env
 * hands back the compat instance; the modular API (which src/data uses)
 * accepts it and unwraps it internally.
 */
export const dbAs = (env: RulesTestEnvironment, uid: string): Firestore =>
  env.authenticatedContext(uid).firestore() as unknown as Firestore;

export const dbAnonymous = (env: RulesTestEnvironment): Firestore =>
  env.unauthenticatedContext().firestore() as unknown as Firestore;

/**
 * LEGAL_VERSIONS read from lib/legal.ts as text (it imports app code Node
 * can't load). The rules pin the same values; tests/rules.test.ts checks both.
 */
export function legalVersions(): { terms: string; privacy: string } {
  const source = readFileSync(new URL('../lib/legal.ts', import.meta.url), 'utf8');
  const terms = source.match(/terms: '([^']+)'/)?.[1];
  const privacy = source.match(/privacy: '([^']+)'/)?.[1];
  if (!terms || !privacy) throw new Error('LEGAL_VERSIONS not found in lib/legal.ts');
  return { terms, privacy };
}

/** The versions pinned in firestore.rules (currentTermsVersion / currentPrivacyVersion). */
export function rulesVersions(): { terms: string | undefined; privacy: string | undefined } {
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  return {
    terms: rules.match(/function currentTermsVersion\(\) \{\s*return '([^']+)'/)?.[1],
    privacy: rules.match(/function currentPrivacyVersion\(\) \{\s*return '([^']+)'/)?.[1],
  };
}

