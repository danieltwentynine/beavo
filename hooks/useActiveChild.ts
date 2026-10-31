import { useChildStore } from '@/stores/childStore';
import type { BrushingSlot } from '@/types';

const NO_SLOTS: BrushingSlot[] = [];

/** The child currently using the app (persisted per parent), their slots, and the switcher. */
export function useActiveChild() {
  const children = useChildStore((s) => s.children);
  const activeChildId = useChildStore((s) => s.activeChildId);
  const slots = useChildStore((s) => (s.activeChildId ? s.slotsByChild[s.activeChildId] : undefined)) ?? NO_SLOTS;
  const setActiveChild = useChildStore((s) => s.setActiveChildId);
  const child = children.find((c) => c.id === activeChildId) ?? null;
  return { child, children, slots, setActiveChild };
}
