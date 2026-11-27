import * as Notifications from 'expo-notifications';
import { getCalendars } from 'expo-localization';
import { router, usePathname } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { db } from '@/lib/firebase';
import { applyPlan, clearAllReminders, dismissDeliveredReminders, isReminderResponse, reminderPermission } from '@/lib/reminders';
import { ownerIdOf, useAuthStore } from '@/stores/authStore';
import { useChildStore } from '@/stores/childStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { nextReminderLog, planReminders, type PlannedReminder } from '@/src/data/reminders';
import { localDate } from '@/src/data/schedule';
import { watchSessionsOn } from '@/src/data/sessions';
import { watchSlots } from '@/src/data/slots';
import type { BrushingSlot } from '@/types';

const PLAN_DEBOUNCE_MS = 400;

/** After a plan is in place: what is scheduled now, plus today's past times (they may have fired). */
function recordApplied(plan: PlannedReminder[], now: Date): void {
  const store = useSettingsStore.getState();
  store.setReminderLog(nextReminderLog(store.reminderLog, plan, now));
}

/** The device's IANA zone; it is part of every reminder id, so a change re-plans them all. */
const currentZone = (): string => getCalendars()[0]?.timeZone ?? 'local';

/**
 * Keeps this phone's pending reminders equal to the plan (src/data/reminders.ts).
 * Mounted once, in app/_layout.tsx. It owns the whole lifecycle:
 * - re-plans when settings, children, any child's slots or today's sessions
 *   change, and on every return to the foreground (new day, new zone);
 * - no owner (signed out, account deleted, device data erased) or another
 *   owner: cancels everything, clears delivered reminders, resets settings;
 * - a deleted child: its reminders leave the next plan, delivered ones are
 *   cleared and its preferences forgotten;
 * - a tap on a reminder opens Escovação (never starts a session).
 */
export function useReminderSync(): void {
  // undefined while auth is still loading: nothing is decided yet.
  const uid = useAuthStore((s) => (s.isLoading ? undefined : ownerIdOf(s)));
  const loaded = useSettingsStore((s) => s.loaded);
  const reminders = useSettingsStore((s) => s.reminders);
  const cleanupPending = useSettingsStore((s) => s.reminderCleanupPending);
  const dismissPending = useSettingsStore((s) => s.reminderDismissPending);
  const allChildren = useChildStore((s) => s.children);
  const childrenLoaded = useChildStore((s) => s.loaded);
  const frozen = useChildStore((s) => s.frozen);
  const [tick, setTick] = useState(0);
  const [slotsByChild, setSlotsByChild] = useState<Record<string, BrushingSlot[]>>({});
  const [brushedByChild, setBrushedByChild] = useState<Record<string, Set<string>>>({});

  const children = useMemo(() => allChildren.filter((c) => !c.archivedAt), [allChildren]);
  const childKey = children.map((c) => c.id).join(',');
  const today = localDate(new Date()); // re-read on every render; a foreground tick re-renders
  const owned = loaded && typeof uid === 'string' && reminders.ownerId === uid;
  const active = owned && reminders.enabled && !frozen;

  // Foreground: new day, new zone, permission changed in Settings.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setTick((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  // Owner changes: start over for the new owner, or clear everything with none.
  useEffect(() => {
    if (!loaded || uid === undefined) return;
    if (uid === null) {
      void clearAllReminders();
      const r = useSettingsStore.getState().reminders;
      if (r.ownerId !== null || r.enabled || Object.keys(r.prefs).length > 0) useSettingsStore.getState().resetReminders(null);
      return;
    }
    if (reminders.ownerId !== uid) {
      void clearAllReminders();
      useSettingsStore.getState().resetReminders(uid);
    }
  }, [loaded, uid, reminders.ownerId]);

  // A clearing that didn't finish (a cancellation failed, the app was killed): retry
  // at launch and on every foreground until nothing of ours is left. Planning waits.
  useEffect(() => {
    if (loaded && cleanupPending) void clearAllReminders();
  }, [loaded, cleanupPending, tick]);

  // Same for clearing delivered reminders after a child was deleted (Vex round 2).
  useEffect(() => {
    if (loaded && dismissPending) void dismissDeliveredReminders();
  }, [loaded, dismissPending, tick]);

  // A child profile was deleted: forget its preferences and clear delivered reminders.
  const previousChildren = useRef<string[] | null>(null);
  useEffect(() => {
    if (!owned || !childrenLoaded || frozen) return;
    const ids = children.map((c) => c.id);
    const before = previousChildren.current;
    previousChildren.current = ids;
    useSettingsStore.getState().pruneReminderChildren(ids);
    if (before && before.some((id) => !ids.includes(id))) void dismissDeliveredReminders();
  }, [owned, childrenLoaded, frozen, childKey, children]);

  // Every live child's slots and today's sessions, only while reminders are on.
  useEffect(() => {
    if (!active || typeof uid !== 'string') return;
    const stops = children.flatMap((child) => [
      watchSlots(db, uid, child.id, (slots) => setSlotsByChild((prev) => ({ ...prev, [child.id]: slots })), () => undefined),
      watchSessionsOn(db, uid, child.id, today, (sessions) => {
        const brushed = new Set(sessions.filter((s) => s.durationSec > 0).map((s) => `${s.date}|${s.slotId}`));
        setBrushedByChild((prev) => ({ ...prev, [child.id]: brushed }));
      }, () => undefined),
    ]);
    return () => {
      for (const stop of stops) stop();
      setSlotsByChild({});
      setBrushedByChild({});
    };
    // childKey stands for `children`: re-subscribe only when the set of children changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, uid, childKey, today]);

  // Plan and apply.
  useEffect(() => {
    if (!owned || cleanupPending) return;
    if (!active) {
      const now = new Date();
      void applyPlan([]).then((ok) => {
        if (ok) recordApplied([], now);
      });
      return;
    }
    // Wait for every child's slots, or a sibling's reminders would be dropped and re-added.
    if (children.some((c) => !slotsByChild[c.id])) return;
    let stale = false;
    const timer = setTimeout(() => {
      void reminderPermission().then((permission) => {
        if (stale) return;
        const now = new Date();
        const plan = planReminders({
          enabled: permission === 'granted',
          children: children.map((c) => ({ childId: c.id, slots: slotsByChild[c.id] ?? [], brushed: brushedByChild[c.id] ?? new Set<string>() })),
          prefs: reminders.prefs,
          quiet: reminders.quiet,
          now,
          zone: currentZone(),
          // Today's times already past count against the daily cap, across re-plans and restarts.
          log: useSettingsStore.getState().reminderLog,
        });
        void applyPlan(plan).then((ok) => {
          if (ok) recordApplied(plan, now);
        });
      });
    }, PLAN_DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [owned, active, cleanupPending, children, slotsByChild, brushedByChild, reminders.prefs, reminders.quiet, tick]);

  // A tap on a reminder: open Escovação for the active child. Never starts a session.
  const response = Notifications.useLastNotificationResponse();
  const pathname = usePathname();
  useEffect(() => {
    if (!isReminderResponse(response) || typeof uid !== 'string' || !childrenLoaded) return;
    Notifications.clearLastNotificationResponse();
    // Mid-brushing or on its results: stay; leaving would end the session.
    if (pathname.startsWith('/session') || pathname.startsWith('/results')) return;
    try {
      router.navigate('/(tabs)/brushing');
    } catch {
      // Navigation not mounted yet: the launch route lands on Escovação anyway.
    }
  }, [response, uid, childrenLoaded, pathname]);
}
