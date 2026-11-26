/**
 * Is a parent (not a child) known to be using the app right now? Pure, for
 * node --test. Parent-only UI such as error notices (components/ui/ParentNotice.tsx)
 * shows only when this is positively true; anything unknown counts as a child.
 * - child data not loaded yet (cold launch, snapshot still hydrating) → no
 * - an active child → only if that child is not in kid mode
 * - no active child: only when the parent has no children at all (setting up);
 *   children without an active one means a profile switch is mid-way → no
 */
export interface ParentContextInput {
  loaded: boolean;
  activeChild: { kidMode: boolean } | null;
  childCount: number;
}

export function isParentContext({ loaded, activeChild, childCount }: ParentContextInput): boolean {
  if (!loaded) return false;
  if (activeChild) return activeChild.kidMode === false;
  return childCount === 0;
}
