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
