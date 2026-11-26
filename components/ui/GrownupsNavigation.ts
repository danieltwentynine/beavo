import { createContext, type Dispatch, type SetStateAction } from 'react';

export const GrownupsNavigation = createContext<{
  unlockingChildId: string | null;
  setUnlockingChildId: Dispatch<SetStateAction<string | null>>;
}>({
  unlockingChildId: null,
  setUnlockingChildId: () => {},
});
