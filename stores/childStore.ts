import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { create } from 'zustand';

import type { BrushingSlot, Child } from '@/types';

/**
 * Children and their brushing slots, fed by Firestore listeners
 * (hooks/useChildDataSync.ts). The last known state is snapshotted to
 * AsyncStorage per parent so the app can start and brushing can begin offline;
 * Firestore's JS SDK can't persist its own cache on React Native.
 */
interface ChildState {
  children: Child[];
  slotsByChild: Record<string, BrushingSlot[]>;
  activeChildId: string | null;
  /** True once we know the real child list (server data, or a non-empty snapshot). */
  loaded: boolean;
  /** Set while the account is being deleted: listener updates are ignored so the
   *  emptying child list doesn't bounce the parent into "add a child". */
  frozen: boolean;
  setChildren: (children: Child[]) => void;
  setSlots: (childId: string, slots: BrushingSlot[]) => void;
  setActiveChildId: (id: string) => void;
  hydrate: (snapshot: Snapshot) => void;
  freeze: () => void;
  reset: () => void;
}

const initial = { children: [], slotsByChild: {}, activeChildId: null, loaded: false, frozen: false };

export const useChildStore = create<ChildState>((set) => ({
  ...initial,
  setChildren: (children) =>
    set((s) => (s.frozen ? s : {
      children,
      loaded: true,
      activeChildId: children.some((c) => c.id === s.activeChildId) ? s.activeChildId : (children[0]?.id ?? null),
    })),
  freeze: () => set({ frozen: true }),
  setSlots: (childId, slots) => set((s) => ({ slotsByChild: { ...s.slotsByChild, [childId]: slots } })),
  setActiveChildId: (activeChildId) => set({ activeChildId }),
  hydrate: (snap) =>
    set((s) =>
      // Live data that already arrived wins over the stored snapshot.
      s.loaded ? s : { children: snap.children, slotsByChild: snap.slotsByChild, activeChildId: snap.activeChildId, loaded: snap.children.length > 0 },
    ),
  reset: () => set(initial),
}));

// ---- AsyncStorage snapshot (untrusted local input: parse, never crash) ----

const snapshotKey = (uid: string) => `zing.snapshot.v1.${uid}`;

const isoDate = z.coerce.date();
const snapshotSchema = z.object({
  activeChildId: z.string().nullable(),
  children: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      avatarColor: z.string(),
      avatarIcon: z.string(),
      birthYear: z.number().optional(),
      kidMode: z.boolean(),
      createdAt: isoDate,
      archivedAt: isoDate.optional(),
    }),
  ),
  slotsByChild: z.record(
    z.string(),
    z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        icon: z.string(),
        mealType: z.enum(['breakfast', 'lunch', 'dinner', 'custom']),
        windowStart: z.string(),
        windowEnd: z.string(),
        sortOrder: z.number(),
        createdAt: isoDate,
        archivedAt: isoDate.optional(),
      }),
    ),
  ),
});

type Snapshot = z.infer<typeof snapshotSchema>;

export async function loadSnapshot(uid: string): Promise<Snapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(snapshotKey(uid));
    const parsed = snapshotSchema.safeParse(raw ? JSON.parse(raw) : null);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function saveSnapshot(uid: string, s: Pick<ChildState, 'children' | 'slotsByChild' | 'activeChildId'>): Promise<void> {
  try {
    await AsyncStorage.setItem(
      snapshotKey(uid),
      JSON.stringify({ children: s.children, slotsByChild: s.slotsByChild, activeChildId: s.activeChildId }),
    );
  } catch {
    // Costs only the offline head start next launch.
  }
}

/** Remove this parent's child data from the device (sign-out, account deletion). */
export async function clearSnapshot(uid: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(snapshotKey(uid));
  } catch {
    // Nothing else to do.
  }
}
