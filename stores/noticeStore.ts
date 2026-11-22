import { create } from 'zustand';

import type { StringKey } from '@/lib/i18n';

/**
 * Parent-facing notices: a write the server refused, data that couldn't be
 * loaded, a step that needs a connection, or consent that finishes once online.
 * Shown by components/ui/ParentNotice.tsx, never in kid mode, never with
 * technical detail. One notice at a time: a newer one replaces the older.
 * `stale` marks listener-fed data that may be out of date (its listener
 * failed and is being retried).
 */
export type NoticeTone = 'error' | 'info';

export interface Notice {
  id: number;
  key: StringKey;
  tone: NoticeTone;
}

export type StaleSource = 'children' | 'slots' | 'childData' | 'categories';

interface NoticeState {
  notice: Notice | null;
  stale: Partial<Record<StaleSource, boolean>>;
  show: (key: StringKey, tone?: NoticeTone) => void;
  dismiss: () => void;
  setStale: (source: StaleSource, stale: boolean) => void;
}

let nextId = 1;

export const useNoticeStore = create<NoticeState>((set) => ({
  notice: null,
  stale: {},
  show: (key, tone = 'error') =>
    set((s) => (s.notice?.key === key ? s : { notice: { id: nextId++, key, tone } })),
  dismiss: () => set({ notice: null }),
  setStale: (source, stale) => set((s) => (Boolean(s.stale[source]) === stale ? s : { stale: { ...s.stale, [source]: stale } })),
}));

/** True while any listener-fed data may be out of date. */
export const useAnyStale = (): boolean => useNoticeStore((s) => Object.values(s.stale).some(Boolean));
