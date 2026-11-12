import { create } from 'zustand';

import { db } from '@/lib/firebase';
import { saveSession } from '@/lib/sync';
import { ownerIdOf, useAuthStore } from '@/stores/authStore';
import { useChildStore } from '@/stores/childStore';
import { localDate, pickSlotForTime, slotsActiveOn } from '@/src/data/schedule';
import { newSessionId } from '@/src/data/sessions';
import type { ToothZone } from '@/types';

/** The result of a completed brushing session, passed from session → results. */
export interface SessionResult {
  childId: string;
  /** Slot picked on the Brushing tab; null → resolved from the start time. */
  slotId: string | null;
  startedAt: Date;
  /** The full configured length ran (vs. "I'm done" early). */
  completed: boolean;
  score: number;
  zoneStates: Partial<Record<ToothZone, 'empty' | 'active' | 'done' | 'missed'>>;
  missed: ToothZone[];
  durationSeconds: number;
  coachMessage: string;
}

export type SaveStatus = 'saving' | 'pending' | 'saved' | 'failed';

/** How long the child is told we're saving before we say it's kept on the phone.
 *  Offline, the Firestore write never settles at all — this is what ends the wait. */
const PENDING_AFTER_MS = 4000;

interface SessionState {
  lastResult: SessionResult | null;
  saveStatus: SaveStatus;
  saveId: string | null;
  setLastResult: (result: SessionResult | null) => void;
  /** Save the finished session (and retry it) — safe to call more than once. */
  saveLastResult: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  lastResult: null,
  saveStatus: 'saving',
  saveId: null,
  setLastResult: (lastResult) => set({ lastResult, saveStatus: 'saving', saveId: null }),

  saveLastResult: async () => {
    const { lastResult, saveStatus, saveId } = get();
    if (!lastResult || saveStatus === 'saved') return;

    const uid = ownerIdOf(useAuthStore.getState());
    const slots = useChildStore.getState().slotsByChild[lastResult.childId] ?? [];
    // The slot is resolved against the slots active on the day brushing started.
    const day = localDate(lastResult.startedAt);
    const activeThatDay = slotsActiveOn(slots, day);
    const slot = activeThatDay.find((s) => s.id === lastResult.slotId) ?? pickSlotForTime(activeThatDay, lastResult.startedAt);
    if (!uid || !slot) {
      // Signed out, or slots not loaded yet. Keep the result so "Try again" can save it.
      set({ saveStatus: 'failed' });
      return;
    }

    const id = saveId ?? newSessionId(db, uid, lastResult.childId);
    set({ saveId: id, saveStatus: 'saving' });

    // Durable in the on-device outbox once this is called; the promise settles
    // when the server confirms (offline: when back online, or the next launch).
    const write = saveSession({
      uid,
      childId: lastResult.childId,
      id,
      slotId: slot.id,
      date: day,
      startedAt: lastResult.startedAt.toISOString(),
      durationSec: lastResult.durationSeconds,
      completed: lastResult.completed,
    });

    void write.then((ok) => {
      if (get().saveId === id) set({ saveStatus: ok ? 'saved' : 'failed' });
    });

    const settled = await Promise.race([
      write,
      new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), PENDING_AFTER_MS)),
    ]);
    if (settled === 'pending' && get().saveId === id && get().saveStatus === 'saving') {
      set({ saveStatus: 'pending' });
    }
  },
}));
