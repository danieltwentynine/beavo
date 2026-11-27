import { getCalendars } from 'expo-localization';
import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { db } from '@/lib/firebase';
import { planReminders, type ReminderChild, type ReminderSettings } from '@/src/data/reminders';
import { localDate } from '@/src/data/schedule';
import { watchSessionsOn } from '@/src/data/sessions';
import { watchSlots } from '@/src/data/slots';
import { useChildStore } from '@/stores/childStore';
import { useSettingsStore } from '@/stores/settingsStore';

type ChildInputs = Partial<Pick<ReminderChild, 'slots' | 'brushed'>>;
type Snapshot = { scope: string; byChild: Record<string, ChildInputs>; failed: boolean };

function readClock() {
  return { now: new Date(), zone: getCalendars()[0]?.timeZone ?? 'local' };
}

/** Preview what this phone would schedule if the parent enables reminders. */
export function useReminderPreview(owner: string | null, settings: ReminderSettings) {
  const children = useChildStore((state) => state.children);
  const loaded = useChildStore((state) => state.loaded);
  const frozen = useChildStore((state) => state.frozen);
  const log = useSettingsStore((state) => state.reminderLog);
  const childKey = JSON.stringify(children.filter((child) => !child.archivedAt).map((child) => child.id).sort());
  const childIds = useMemo(() => JSON.parse(childKey) as string[], [childKey]);
  const [clock, setClock] = useState(readClock);
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const today = localDate(clock.now);
  const scope = JSON.stringify([owner, childKey, today, attempt]);
  const eligible = !!owner && loaded && !frozen && settings.ownerId === owner;

  useEffect(() => {
    const minute = setInterval(() => setClock(readClock()), 60_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setClock(readClock());
    });
    return () => {
      clearInterval(minute);
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!eligible || !owner) return;
    let live = true;
    function update(change: (current: Snapshot) => Snapshot) {
      if (!live) return;
      setSnapshot((previous) => change(previous?.scope === scope ? previous : { scope, byChild: {}, failed: false }));
    }
    function save(childId: string, value: ChildInputs) {
      update((current) => ({
        ...current,
        byChild: { ...current.byChild, [childId]: { ...current.byChild[childId], ...value } },
      }));
    }
    const onError = () => update((current) => ({ ...current, failed: true }));
    const stops = childIds.flatMap((childId) => [
      watchSlots(db, owner, childId, (slots) => save(childId, { slots }), onError),
      watchSessionsOn(db, owner, childId, today, (sessions) => {
        const brushed = new Set(sessions.filter((session) => session.durationSec > 0).map((session) => `${session.date}|${session.slotId}`));
        save(childId, { brushed });
      }, onError),
    ]);
    return () => {
      live = false;
      stops.forEach((stop) => stop());
    };
  }, [eligible, owner, childIds, today, scope]);

  const current = eligible && snapshot?.scope === scope ? snapshot : undefined;
  const failed = current?.failed ?? false;
  const inputs = childIds.flatMap((childId) => {
    const data = current?.byChild[childId];
    return data?.slots && data.brushed ? [{ childId, slots: data.slots, brushed: data.brushed }] : [];
  });
  const plan = current && !failed && inputs.length === childIds.length
    ? planReminders({ enabled: true, children: inputs, prefs: settings.prefs, quiet: settings.quiet, log, ...clock })
    : null;

  return { plan, failed, retry: () => { setClock(readClock()); setAttempt((value) => value + 1); } };
}
