import { create } from 'zustand';

import { recordSession } from '@/lib/children';
import { newSessionId, saveSession } from '@/lib/sessions';
import { nextStreak } from '@/lib/streak';
import { ownerIdOf, useAuthStore } from '@/stores/authStore';
import { useChildStore } from '@/stores/childStore';
import type { ToothZone } from '@/types';

/** The result of a completed brushing session, passed from session → results. */
export interface SessionResult {
  score: number;
  zoneStates: Partial<Record<ToothZone, 'empty' | 'active' | 'done' | 'missed'>>;
  missed: ToothZone[];
  durationSeconds: number;
  coachMessage: string;
}

export type SaveStatus = 'saving' | 'pending' | 'saved' | 'failed';

/** How long the child is told we're saving before we admit we can't confirm it.
 *  Offline, the Firestore write never settles at all — this is what ends the wait. */
const PENDING_AFTER_MS = 4000;

interface SessionState {
  lastResult: SessionResult | null;
  saveStatus: SaveStatus;
  saveId: string | null;
  finishedAt: Date | null;
  setLastResult: (result: SessionResult | null) => void;
  /** Save the finished session (and retry it) — safe to call more than once. */
  saveLastResult: () => Promise<void>;
}

// The session doc is idempotent through its stable id, but the child's
// totalSessions is an increment — this keeps a double-tapped retry from
// counting the same session twice.
let inFlight = false;

export const useSessionStore = create<SessionState>((set, get) => ({
  lastResult: null,
  saveStatus: 'saving',
  saveId: null,
  finishedAt: null,
  setLastResult: (lastResult) =>
    set({
      lastResult,
      saveStatus: 'saving',
      saveId: null,
      finishedAt: lastResult ? new Date() : null,
    }),

  saveLastResult: async () => {
    const { lastResult, saveStatus, saveId, finishedAt } = get();
    if (!lastResult || saveStatus === 'saved' || inFlight) return;

    const ownerId = ownerIdOf(useAuthStore.getState());
    const child = useChildStore.getState().activeChild;
    if (!ownerId || child?.parentUid !== ownerId) {
      // Signed out, or the profile hasn't loaded. Keep the result so "Try again"
      // can still save it once the parent is back, instead of dropping it.
      set({ saveStatus: 'failed' });
      return;
    }

    const id = saveId ?? newSessionId();
    inFlight = true;
    set({ saveId: id, saveStatus: 'saving' });

    // The moment brushing ended, not the moment this attempt runs — a retry
    // must not move the session to a different day or streak.
    const now = finishedAt ?? new Date();
    const streak = nextStreak(child, now);
    const zones = Object.entries(lastResult.zoneStates);

    // Already durable in the outbox once this call is made; offline the promise
    // below stays pending until the device is back online (possibly never, if the
    // app is killed first — the next launch flushes it).
    const write = saveSession({
      id,
      childId: child.id,
      parentUid: ownerId,
      completedAt: now,
      durationSeconds: lastResult.durationSeconds,
      zonesDetected: zones.filter(([, s]) => s === 'done').map(([zone]) => zone as ToothZone),
      zonesCoverage: Object.fromEntries(zones.map(([zone, s]) => [zone, s === 'done' ? 100 : 0])),
      score: lastResult.score,
      coachMessage: lastResult.coachMessage,
      streak,
    });

    // Whenever it confirms — now, or minutes later while the child is still on
    // the results screen — finish the same way, unless a newer session took over.
    void write.then(async (ok) => {
      inFlight = false;
      if (get().saveId !== id) return;
      set({ saveStatus: ok ? 'saved' : 'failed' });
      if (!ok) return;

      const updated = await recordSession(child, { streakCurrent: streak, score: lastResult.score, now });
      if (updated) useChildStore.getState().setActiveChild(updated);
    });

    const settled = await Promise.race([
      write,
      new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), PENDING_AFTER_MS)),
    ]);
    if (settled === 'pending') {
      // Offline the write never settles, so `.then` above would hold this flag
      // forever and every later session would bail at the guard. Release it
      // here: the only way back in is a NEW session, whose different saveId
      // makes the stale continuation above bail instead of double-counting.
      inFlight = false;
      if (get().saveId === id && get().saveStatus === 'saving') set({ saveStatus: 'pending' });
    }
  },
}));
