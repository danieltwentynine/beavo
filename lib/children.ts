import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { z } from 'zod';

import type { Badge, ChildProfile } from '@/types';
import { daysBrushedThisWeek, newBadges } from '@/lib/badges';
import { db, timestampToDate } from '@/lib/firebase';
import { LOCAL_UID } from '@/lib/localData';
import {
  clearLocalData,
  readLocalChild,
  readLocalSessions,
  writeLocalChild,
} from '@/lib/localStore';
import { fetchRecentSessions, sessionDoc } from '@/lib/sessions';

const badgeSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['streak', 'perfect', 'firstSession', 'weeklyGoal']),
  earnedAt: timestampToDate,
});

// Firestore data can be malformed — validate every read (CLAUDE.md rule).
const childDocSchema = z.object({
  parentUid: z.string(),
  name: z.string(),
  age: z.number(),
  avatarId: z.string(),
  streakCurrent: z.number().default(0),
  streakBest: z.number().default(0),
  totalSessions: z.number().default(0),
  badges: z.array(badgeSchema).default([]),
  createdAt: timestampToDate.optional(),
  lastSessionAt: timestampToDate.optional(),
});

export interface NewChildInput {
  name: string;
  age: number;
  avatarId: string;
}

export async function createChild(parentUid: string, input: NewChildInput): Promise<ChildProfile> {
  const profile = { parentUid, ...input, streakCurrent: 0, streakBest: 0, totalSessions: 0, badges: [] as Badge[] };
  if (parentUid === LOCAL_UID) {
    // Firestore's id generator is offline — reusing it lets a later move to an
    // account keep the same id as the doc id.
    const child = { id: doc(collection(db, 'children')).id, ...profile, createdAt: new Date() };
    await writeLocalChild(child);
    return child;
  }
  const ref = await addDoc(collection(db, 'children'), { ...profile, createdAt: serverTimestamp() });
  return { id: ref.id, ...profile, createdAt: new Date() };
}

/**
 * The parent's first (active) child, or null if they have none yet.
 * Throws on query failure so callers can tell an outage apart from "no child"
 * — mixing the two would send an existing parent back through child setup.
 * Equality-only filter + client-side sort: needs no composite index and stays
 * provably within the parentUid security rules.
 */
export async function fetchActiveChild(parentUid: string): Promise<ChildProfile | null> {
  if (parentUid === LOCAL_UID) return readLocalChild();
  const q = query(collection(db, 'children'), where('parentUid', '==', parentUid));
  const snap = await getDocs(q);
  // Offline, the SDK answers from its (in-memory, so empty after a cold start)
  // cache instead of failing. "No child" may only come from the server —
  // otherwise an existing parent is sent to child setup, or device data is
  // moved into an account that already has a child.
  if (snap.empty && snap.metadata.fromCache) {
    throw new Error('Children could not be read from the server');
  }
  if (snap.empty) return null;

  const children = snap.docs.flatMap((docSnap) => {
    const parsed = childDocSchema.safeParse(docSnap.data());
    if (!parsed.success) return [];
    return [
      {
        id: docSnap.id,
        ...parsed.data,
        createdAt: parsed.data.createdAt ?? new Date(),
      },
    ];
  });
  if (children.length === 0) {
    throw new Error('Child documents exist but none passed validation');
  }

  children.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return children[0];
}

/** Matches the internal doc cap of `fetchRecentSessions`. */
const SESSION_COUNT_CAP = 200;

export interface SessionRecord {
  streakCurrent: number;
  score: number;
  now: Date;
}

/**
 * Advance the child's counters and award any newly earned badges after a
 * session was persisted. `streakCurrent`, `score` and `now` come from the
 * caller so the session doc and the profile agree on the same streak, the same
 * score and the same clock reading.
 *
 * Returns the updated profile for the store, or null if the write failed — the
 * session itself is already saved, so the counters and badges catch up on the
 * next one.
 */
export async function recordSession(
  child: ChildProfile,
  session: SessionRecord,
): Promise<ChildProfile | null> {
  const { streakCurrent, score, now } = session;
  const streakBest = Math.max(child.streakBest, streakCurrent);
  let counted: number | null = null;
  let totalSessions = child.totalSessions + 1;
  let earned: Badge[] = [];

  // Everything from here degrades quietly: the session doc is already saved.
  try {
    // This child's history, including the session just saved — null when it
    // can't be trusted (failed, or capped out), so we fall back to a blind
    // increment. Children created before session counting existed carry a
    // stale `totalSessions: 0`; reconciling from the docs backfills them.
    // ponytail: the count saturates at SESSION_COUNT_CAP, after which a child
    // goes back to incrementing (both count badges long earned by then).
    // Upgrade path: an indexed count() aggregate.
    const sessions = await fetchRecentSessions(child.parentUid, child.id, SESSION_COUNT_CAP);
    const history = sessions.length === 0 || sessions.length >= SESSION_COUNT_CAP ? null : sessions;
    // Never walk the counter backwards if the history read came up short.
    counted = history ? Math.max(history.length, child.totalSessions) : null;
    totalSessions = counted ?? totalSessions;
    earned = newBadges(
      child.badges,
      {
        totalSessions,
        streakCurrent,
        score,
        // No trustworthy history means no week to count; the badge catches up
        // on the next session rather than being awarded on a guess.
        daysThisWeek: history ? daysBrushedThisWeek(history.map((s) => s.completedAt), now) : 0,
      },
      now,
    );
    const updated: ChildProfile = {
      ...child,
      totalSessions,
      streakCurrent,
      streakBest,
      badges: [...child.badges, ...earned],
      lastSessionAt: now,
    };
    if (child.parentUid === LOCAL_UID) {
      await writeLocalChild(updated);
      return updated;
    }
    await updateDoc(doc(db, 'children', child.id), {
      totalSessions: counted ?? increment(1),
      streakCurrent,
      streakBest,
      lastSessionAt: Timestamp.fromDate(now),
      // Timestamp, not serverTimestamp() — a sentinel inside an array is illegal
      // and a raw Date wouldn't survive `badgeSchema` on the way back.
      ...(earned.length > 0 ? { badges: badgeDocs(updated.badges) } : {}),
    });
    return updated;
  } catch {
    return null;
  }
}

const badgeDocs = (badges: Badge[]) =>
  badges.map((badge) => ({ ...badge, earnedAt: Timestamp.fromDate(badge.earnedAt) }));

/** Firestore allows 500 writes per batch. */
const BATCH_SIZE = 400;

/**
 * A parent who used Zing without an account has just signed in to one that has
 * no child yet: move the device's child and history into it. Returns the moved
 * profile, or null if the device holds no child or the parent declined.
 *
 * `confirm` gets the device child's name and must be answered by the parent:
 * whoever signs in on this phone is not necessarily the parent whose child is
 * stored on it, and the move uploads that child to their account.
 *
 * Device ids are reused as doc ids, so a retry after a partial failure
 * overwrites instead of duplicating. The child doc goes in the last batch: it
 * is what `fetchActiveChild` finds, so it must not exist before its history
 * does. Throws on failure, leaving the device data untouched.
 */
export function moveLocalDataToAccount(
  uid: string,
  confirm: (childName: string) => Promise<boolean>,
): Promise<ChildProfile | null> {
  // Home and Progress can both ask at once; the second caller would otherwise
  // find the device already emptied and conclude there is no child at all.
  if (move?.uid !== uid) {
    const promise = runMove(uid, confirm).catch((error: unknown) => {
      move = null;
      throw error;
    });
    move = { uid, promise };
  }
  return move.promise;
}

let move: { uid: string; promise: Promise<ChildProfile | null> } | null = null;

async function runMove(
  uid: string,
  confirm: (childName: string) => Promise<boolean>,
): Promise<ChildProfile | null> {
  const local = await readLocalChild();
  if (!local) return null;
  if (!(await confirm(local.name))) return null;
  const sessions = (await readLocalSessions()).filter((s) => s.childId === local.id);
  // lastSessionAt is optional, and Firestore rejects an explicit `undefined`.
  const { id, lastSessionAt, ...profile } = local;

  for (let start = 0; start === 0 || start < sessions.length; start += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = sessions.slice(start, start + BATCH_SIZE);
    for (const session of chunk) {
      batch.set(doc(db, 'sessions', session.id), sessionDoc({ ...session, parentUid: uid }));
    }
    if (start + BATCH_SIZE >= sessions.length) {
      batch.set(doc(db, 'children', id), {
        ...profile,
        parentUid: uid,
        badges: badgeDocs(local.badges),
        createdAt: Timestamp.fromDate(local.createdAt),
        ...(lastSessionAt ? { lastSessionAt: Timestamp.fromDate(lastSessionAt) } : {}),
      });
    }
    await batch.commit();
  }

  await clearLocalData();
  return { ...local, parentUid: uid };
}
