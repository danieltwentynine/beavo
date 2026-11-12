import { z } from 'zod';

import type { ChildProfile } from '@/types';

/**
 * Device-only mode: a parent using Zing without an account. Their data never
 * reaches Firestore; it is owned by this reserved id instead of a Firebase uid.
 * Kept dependency-free (no firebase, no AsyncStorage) so `lib/localData.check.mjs`
 * can run it under plain node — the storage side lives in `lib/localStore.ts`.
 */
export const LOCAL_UID = 'local';

export const LOCAL_MODE_KEY = 'zing.localMode.v1';
export const LOCAL_CHILD_KEY = 'zing.localChild.v1';
export const LOCAL_SESSIONS_KEY = 'zing.localSessions.v1';

const isoDate = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), 'unparseable date')
  .transform((s) => new Date(s));

const storedChildSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  age: z.number(),
  avatarId: z.string(),
  streakCurrent: z.number().default(0),
  streakBest: z.number().default(0),
  totalSessions: z.number().default(0),
  badges: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.enum(['streak', 'perfect', 'firstSession', 'weeklyGoal']),
        earnedAt: isoDate,
      }),
    )
    .default([]),
  createdAt: isoDate,
  lastSessionAt: isoDate.optional(),
});

/** Dates become ISO strings through `Date.prototype.toJSON`. */
export function encodeChild(child: ChildProfile): string {
  return JSON.stringify(child);
}

/**
 * Storage is untrusted input: bad JSON or a profile from an older app version
 * reads as "no child yet" — never a crash on launch.
 */
export function decodeChild(raw: string | null): ChildProfile | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const child = storedChildSchema.safeParse(parsed);
  // Whatever was stored, a device profile is always owned by LOCAL_UID.
  return child.success ? { ...child.data, parentUid: LOCAL_UID } : null;
}
