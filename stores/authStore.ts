import type { User } from 'firebase/auth';
import { create } from 'zustand';

/**
 * unknown: still checking · needed: never accepted · updated: accepted an older
 * version of a document · ok: current versions accepted.
 */
export type ConsentStatus = 'unknown' | 'needed' | 'updated' | 'ok';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  consent: ConsentStatus;
  setUser: (user: User | null) => void;
  setConsent: (consent: ConsentStatus) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  consent: 'unknown',
  setUser: (user) => set({ user, isLoading: false, consent: 'unknown' }),
  setConsent: (consent) => set({ consent }),
}));
