import { z } from 'zod';

/**
 * On-device outbox for finished brushing sessions the server hasn't confirmed.
 * A session lands here before the Firestore write, so it survives the app being
 * killed offline; the next launch (or return to foreground) retries it.
 * Pure (no firebase, no AsyncStorage) so `node --test` runs it — the storage
 * side lives in lib/sync.ts.
 */
export const OUTBOX_KEY = 'beavo.sessionOutbox.v2';

/** Newest wins. A backlog deeper than this means something is badly wrong anyway. */
const MAX_ENTRIES = 50;

/** The stored shape: one session doc plus where it goes, JSON-safe (dates as ISO strings). */
const pendingSessionSchema = z.object({
  uid: z.string().min(1),
  childId: z.string().min(1),
  id: z.string().min(1),
  slotId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startedAt: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'unparseable date'),
  durationSec: z.number().int().nonnegative(),
  completed: z.boolean(),
});

export type PendingSession = z.infer<typeof pendingSessionSchema>;

export function encodeOutbox(entries: readonly PendingSession[]): string {
  return JSON.stringify(entries.slice(-MAX_ENTRIES));
}

/**
 * Storage is untrusted input: bad JSON, a half-written value, or entries from an
 * older app version degrade to "nothing pending" — never crash the launch.
 * Malformed entries are dropped one by one so a bad row can't strand good ones.
 */
export function decodeOutbox(raw: string | null): PendingSession[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => {
    const entry = pendingSessionSchema.safeParse(item);
    return entry.success ? [entry.data] : [];
  });
}

/** Insert or replace by session id (a retry of the same session never duplicates). */
export const upsertEntry = (entries: readonly PendingSession[], entry: PendingSession): PendingSession[] => [
  ...entries.filter((e) => e.id !== entry.id),
  entry,
];
