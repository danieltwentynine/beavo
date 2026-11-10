/**
 * Google sign-in → Firebase Auth credential exchange.
 *
 * Get a Google ID token, wrap it in a Firebase credential, then
 * `signInWithCredential`. Cancellation is a normal outcome, not an error —
 * callers must not show a message for it.
 */
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { FirebaseError } from 'firebase/app';
import {
  GoogleAuthProvider,
  reauthenticateWithCredential,
  signInWithCredential,
  type User,
} from 'firebase/auth';

import { auth } from '@/lib/firebase';

GoogleSignin.configure({
  // Web client ID is what Firebase verifies the ID token against — required
  // even though this is a native app.
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

export type SocialSignInResult =
  | { status: 'success' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

function socialErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/account-exists-with-different-credential':
      case 'auth/email-already-in-use':
        return 'You already have a Beavo account with this email. Log in the way you signed up first, then you can add this option.';
      case 'auth/network-request-failed':
        return 'No connection. Please check your internet and try again.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a moment and try again.';
      case 'auth/invalid-credential':
        return "That sign-in didn't go through. Please try again.";
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.';
    }
  }
  return "We couldn't sign you in right now. Please try again.";
}

export async function signInWithGoogle(): Promise<SocialSignInResult> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      return { status: 'cancelled' };
    }

    const { idToken } = response.data;
    if (!idToken) {
      return { status: 'error', message: socialErrorMessage(null) };
    }

    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));

    // users/{uid} is written at consent (lib/consent.ts), not here: the
    // profile only exists once the parent has accepted the documents.
    return { status: 'success' };
  } catch (error) {
    // v16 signals cancellation via the response type above, but the Android
    // legacy SDK path can still throw it.
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) {
      return { status: 'cancelled' };
    }
    return { status: 'error', message: socialErrorMessage(error) };
  }
}

/**
 * Fresh Google sign-in for the current user, required by Firebase before
 * deleting the account. Resolves 'cancelled' when the parent backs out.
 */
export async function reauthenticateWithGoogle(user: User): Promise<'ok' | 'cancelled'> {
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return 'cancelled';
  const { idToken } = response.data;
  if (!idToken) throw new Error('Google returned no ID token');
  await reauthenticateWithCredential(user, GoogleAuthProvider.credential(idToken));
  return 'ok';
}

/** Google keeps its own native session — clear it alongside the Firebase one. */
export async function signOutGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Never block logout on the provider session.
  }
}
