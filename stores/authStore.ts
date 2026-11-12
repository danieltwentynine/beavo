import type { User } from 'firebase/auth';
import { create } from 'zustand';

import { LOCAL_UID } from '@/src/data/local';

/**
 * unknown: still checking · needed: never accepted · updated: accepted an older
 * version of a document · ok: current versions accepted.
 */
export type ConsentStatus = 'unknown' | 'needed' | 'updated' | 'ok';

interface AuthState {
  user: User | null;
  /** The parent chose to use Beavo without an account: data stays on this device (ADR 0005). */
  isLocal: boolean;
  /** True until both the Firebase auth state and the stored device-only choice are known. */
  isLoading: boolean;
  consent: ConsentStatus;
  /** The parent said no (this run) to moving this device's data into the account they signed in to. */
  moveDeclined: boolean;
  setUser: (user: User | null) => void;
  setLocal: (isLocal: boolean) => void;
  setConsent: (consent: ConsentStatus) => void;
  declineMove: () => void;
}

let userKnown = false;
let localKnown = false;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLocal: false,
  isLoading: true,
  consent: 'unknown',
  moveDeclined: false,
  setUser: (user) => {
    userKnown = true;
    // Consent belongs to an owner: keep it unless the signed-in parent actually changed.
    set((s) => ({ user, isLoading: !localKnown, moveDeclined: false, consent: s.user?.uid === user?.uid ? s.consent : 'unknown' }));
  },
  setLocal: (isLocal) => {
    localKnown = true;
    // Signed in, the owner is the account either way, so its consent still stands.
    set((s) => ({ isLocal, isLoading: !userKnown, consent: s.user ? s.consent : 'unknown' }));
  },
  setConsent: (consent) => set({ consent }),
  declineMove: () => set({ moveDeclined: true }),
}));

/**
 * Who owns the data on screen: the signed-in parent, else this device, else
 * nobody yet. Always use this for repository calls — never `user.uid` directly.
 */
export const ownerIdOf = ({ user, isLocal }: Pick<AuthState, 'user' | 'isLocal'>): string | null =>
  user?.uid ?? (isLocal ? LOCAL_UID : null);
