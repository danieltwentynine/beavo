import type { User } from 'firebase/auth';
import { create } from 'zustand';

import { LOCAL_UID } from '@/lib/localData';

interface AuthState {
  user: User | null;
  /** The parent chose to use Zing without an account — data stays on the device. */
  isLocal: boolean;
  /** True until both the Firebase auth state and the stored device-only flag are known. */
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLocal: (isLocal: boolean) => void;
}

let userKnown = false;
let localKnown = false;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLocal: false,
  isLoading: true,
  setUser: (user) => {
    userKnown = true;
    set({ user, isLoading: !localKnown });
  },
  setLocal: (isLocal) => {
    localKnown = true;
    set({ isLocal, isLoading: !userKnown });
  },
}));

/** Who owns the data on screen: the signed-in parent, else the device, else nobody yet. */
export const ownerIdOf = ({ user, isLocal }: Pick<AuthState, 'user' | 'isLocal'>): string | null =>
  user?.uid ?? (isLocal ? LOCAL_UID : null);
