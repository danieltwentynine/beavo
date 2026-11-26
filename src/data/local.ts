import type { BrushingSession, BrushingSlot, Category, Child, ToothEvent } from '@/types';

import { BACKUP_FORMAT, BACKUP_VERSION, parseBackup, type Backup, type BackupChild } from './backup.ts';
import type { ChildInput } from './children.ts';
import { slotRemoval, type NewSlot } from './schedule.ts';
import type { SlotPatch } from './slots.ts';

/**
 * Device-only mode (ADR 0005): a parent using Beavo without an account. Their
 * data never reaches Firestore; the repositories route to this store whenever
 * the owner is `LOCAL_UID` instead of a Firebase uid.
 *
 * The store IS a backup file (backup.ts) held in memory and saved as one JSON
 * value: moving to an account is then `importBackup`, exporting is the store
 * itself, and every write is re-validated with `parseBackup` before it is kept,
 * so what is on disk can always be read back.
 *
 * Pure (no firebase, no AsyncStorage) for `node --test`; lib/localData.ts
 * supplies the storage.
 */
export const LOCAL_UID = 'local';
export const LOCAL_DATA_KEY = 'beavo.local.v1';

const empty = (): Backup => ({ format: BACKUP_FORMAT, version: BACKUP_VERSION, categories: [], children: [] });

let state: Backup = empty();
let save: (text: string) => Promise<void> = async () => undefined;
let saving: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();
let markReady: () => void = () => undefined;
const ready = new Promise<void>((resolve) => {
  markReady = resolve;
});

/**
 * Load what storage holds and start answering. Until this is called, listeners
 * stay silent and writes wait — an unread store must never look like an empty
 * one. Returns false when `text` was there but unreadable (the store then
 * starts empty; the caller keeps the unreadable copy).
 */
export function hydrateLocal(text: string | null, persist: (text: string) => Promise<void>): boolean {
  const parsed = text ? parseBackup(text) : null;
  state = parsed ?? empty();
  save = persist;
  markReady();
  for (const listener of listeners) listener();
  return !text || parsed !== null;
}

// ponytail: the whole store is rewritten and re-validated on every change —
// milliseconds at family scale (~1,100 sessions a child per year). Split by
// child, or append sessions separately, if a history ever makes saving slow.
async function change(update: (current: Backup) => Backup): Promise<void> {
  await ready;
  const text = JSON.stringify(update(state));
  const next = parseBackup(text);
  if (!next) throw new Error('Rejected: the change would make the device data unreadable');
  state = next;
  for (const listener of listeners) listener();
  // One save at a time, in order: a slow earlier write can't land on top of a later one.
  saving = saving.catch(() => undefined).then(() => save(text));
  await saving;
}

function watch<T>(select: (current: Backup) => T, onChange: (value: T) => void): () => void {
  let active = true;
  const emit = () => {
    if (active) onChange(select(state));
  };
  void ready.then(() => {
    if (!active) return;
    listeners.add(emit);
    emit();
  });
  return () => {
    active = false;
    listeners.delete(emit);
  };
}

const changeChild = (childId: string, update: (child: BackupChild) => BackupChild) =>
  change((s) => ({ ...s, children: s.children.map((c) => (c.id === childId ? update(c) : c)) }));

const findChild = (s: Backup, childId: string) => s.children.find((c) => c.id === childId);

/** `incoming` wins over `existing` on the same id; nothing is removed. */
function mergeById<T extends { id: string }>(existing: readonly T[], incoming: readonly T[]): T[] {
  const ids = new Set(incoming.map((i) => i.id));
  return [...existing.filter((e) => !ids.has(e.id)), ...incoming];
}

const toSlot = (slot: BackupChild['brushingSlots'][number]): BrushingSlot => ({ ...slot, archivedAt: slot.archivedAt ?? undefined });

// ---- Children ----

export function watchLocalChildren(onChange: (children: Child[]) => void): () => void {
  return watch(
    (s) =>
      s.children
        .map(({ brushingSlots: _slots, brushingSessions: _sessions, toothEvents: _events, birthYear, archivedAt: _archived, ...child }) => ({
          ...child,
          birthYear: birthYear ?? undefined,
        }))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    onChange,
  );
}

export function localCreateChild(id: string, input: ChildInput, slots: readonly (NewSlot & { id: string })[], now: Date): Promise<void> {
  return change((s) => ({
    ...s,
    children: [
      ...s.children,
      {
        id,
        name: input.name,
        avatarColor: input.avatarColor,
        avatarIcon: input.avatarIcon,
        birthYear: input.birthYear ?? null,
        kidMode: false,
        createdAt: now,
        archivedAt: null,
        brushingSlots: slots.map((slot) => ({ ...slot, createdAt: now, archivedAt: null })),
        brushingSessions: [],
        toothEvents: [],
      },
    ],
  }));
}

export function localUpdateChild(childId: string, patch: Partial<ChildInput & { kidMode: boolean }>): Promise<void> {
  const { birthYear, ...rest } = patch;
  return changeChild(childId, (c) => ({ ...c, ...rest, ...('birthYear' in patch ? { birthYear: birthYear ?? null } : {}) }));
}

export const localDeleteChild = (childId: string): Promise<void> =>
  change((s) => ({ ...s, children: s.children.filter((c) => c.id !== childId) }));

// ---- Brushing slots ----

export const watchLocalSlots = (childId: string, onChange: (slots: BrushingSlot[]) => void): (() => void) =>
  watch((s) => (findChild(s, childId)?.brushingSlots ?? []).map(toSlot), onChange);

export const localAddSlot = (childId: string, id: string, slot: NewSlot, now: Date): Promise<void> =>
  changeChild(childId, (c) => ({ ...c, brushingSlots: [...c.brushingSlots, { ...slot, id, createdAt: now, archivedAt: null }] }));

export const localUpdateSlot = (childId: string, slotId: string, patch: SlotPatch): Promise<void> =>
  changeChild(childId, (c) => ({ ...c, brushingSlots: c.brushingSlots.map((slot) => (slot.id === slotId ? { ...slot, ...patch } : slot)) }));

export const localReorderSlots = (childId: string, orderedIds: readonly string[]): Promise<void> =>
  changeChild(childId, (c) => ({
    ...c,
    brushingSlots: c.brushingSlots.map((slot) => {
      const sortOrder = orderedIds.indexOf(slot.id);
      return sortOrder === -1 ? slot : { ...slot, sortOrder };
    }),
  }));

export async function localHasSessionsForSlot(childId: string, slotId: string): Promise<boolean> {
  await ready;
  return (findChild(state, childId)?.brushingSessions ?? []).some((session) => session.slotId === slotId);
}

/** Same rule as the account: a slot with sessions is archived, never deleted. */
export async function localRemoveSlot(childId: string, slotId: string, now: Date): Promise<{ action: 'archive' | 'delete'; written: Promise<void> }> {
  const action = slotRemoval(await localHasSessionsForSlot(childId, slotId));
  const written = changeChild(childId, (c) => ({
    ...c,
    brushingSlots:
      action === 'delete'
        ? c.brushingSlots.filter((slot) => slot.id !== slotId)
        : c.brushingSlots.map((slot) => (slot.id === slotId ? { ...slot, archivedAt: now } : slot)),
  }));
  return { action, written };
}

// ---- Brushing sessions ----

export const watchLocalSessions = (childId: string, onChange: (sessions: BrushingSession[]) => void): (() => void) =>
  watch((s) => findChild(s, childId)?.brushingSessions ?? [], onChange);

/** Idempotent in `session.id`. Rejects if the child is not on this device. */
export function localWriteSession(childId: string, session: BrushingSession): Promise<void> {
  return change((s) => {
    if (!findChild(s, childId)) throw new Error('No such child on this device');
    return { ...s, children: s.children.map((c) => (c.id === childId ? { ...c, brushingSessions: mergeById(c.brushingSessions, [session]) } : c)) };
  });
}

// ---- Tooth events ----

export const watchLocalToothEvents = (childId: string, onChange: (events: ToothEvent[]) => void): (() => void) =>
  watch((s) => findChild(s, childId)?.toothEvents ?? [], onChange);

export const localAddToothEvents = (childId: string, events: readonly ToothEvent[]): Promise<void> =>
  changeChild(childId, (c) => ({ ...c, toothEvents: mergeById(c.toothEvents, events) }));

export const localDeleteToothEvent = (childId: string, eventId: string): Promise<void> =>
  changeChild(childId, (c) => ({ ...c, toothEvents: c.toothEvents.filter((event) => event.id !== eventId) }));

// ---- Categories ----

export const watchLocalCategories = (onChange: (categories: Category[]) => void): (() => void) => watch((s) => s.categories, onChange);

/** Adds the defaults that are missing; never overwrites one the parent renamed. */
export const localSeedCategories = (defaults: readonly Category[]): Promise<void> =>
  change((s) => ({ ...s, categories: mergeById(defaults, s.categories) }));

export const localAddCategory = (category: Category): Promise<void> => change((s) => ({ ...s, categories: [...s.categories, category] }));

export const localUpdateCategory = (categoryId: string, patch: Partial<Pick<Category, 'name' | 'color'>>): Promise<void> =>
  change((s) => ({ ...s, categories: s.categories.map((category) => (category.id === categoryId ? { ...category, ...patch } : category)) }));

export const localDeleteCategory = (categoryId: string): Promise<void> =>
  change((s) => ({ ...s, categories: s.categories.filter((category) => category.id !== categoryId) }));

// ---- Whole store: export, import, move to an account, erase ----

/** Everything on this device, as a backup. */
export async function localBackup(): Promise<Backup> {
  await ready;
  return state;
}

/** Merge a backup into the device data by id (same contract as importBackup). Returns the records merged. */
export async function localImport(backup: Backup): Promise<number> {
  await change((s) => ({
    ...s,
    categories: mergeById(s.categories, backup.categories),
    children: [
      ...s.children.filter((c) => !backup.children.some((incoming) => incoming.id === c.id)),
      ...backup.children.map((incoming) => {
        const existing = findChild(s, incoming.id);
        return {
          ...incoming,
          brushingSlots: mergeById(existing?.brushingSlots ?? [], incoming.brushingSlots),
          brushingSessions: mergeById(existing?.brushingSessions ?? [], incoming.brushingSessions),
          toothEvents: mergeById(existing?.toothEvents ?? [], incoming.toothEvents),
        };
      }),
    ],
  }));
  return backup.categories.length + backup.children.reduce((n, c) => n + 1 + c.brushingSlots.length + c.brushingSessions.length + c.toothEvents.length, 0);
}

/** Remove every child and category from the device. */
export const localClear = (): Promise<void> => change(empty);
