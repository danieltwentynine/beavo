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
  getAdditionalUserInfo,
  signInWithCredential,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { auth, db } from '@/lib/firebase';
import { t } from '@/lib/i18n';

GoogleSignin.configure({
  // Web client ID is what Firebase verifies the ID token against — required
  // even though this is a native app.
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

export type SocialSignInResult =
  | { status: 'success'; isNewUser: boolean }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

function socialErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/account-exists-with-different-credential':
      case 'auth/email-already-in-use':
        return t('auth.err.exists');
      case 'auth/network-request-failed':
        return t('auth.err.network');
      case 'auth/too-many-requests':
        return t('auth.err.tooMany');
      case 'auth/invalid-credential':
        return t('auth.err.socialInvalid');
      case 'auth/user-disabled':
        return t('auth.err.disabled');
    }
  }
  return t('auth.err.socialGeneric');
}

export async function signInWithGoogle(): Promise<SocialSignInResult> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      return { status: 'cancelled' };
    }

    const { idToken, user } = response.data;
    if (!idToken) {
      return { status: 'error', message: socialErrorMessage(null) };
    }

    const result = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    const isNewUser = getAdditionalUserInfo(result)?.isNewUser ?? false;

    if (isNewUser) {
      try {
        await setDoc(
          doc(db, 'users', result.user.uid),
          {
            email: result.user.email ?? '',
            displayName: user.name ?? result.user.displayName ?? '',
            createdAt: serverTimestamp(),
          },
          { merge: true },
        );
      } catch {
        // Best-effort, mirrors register.tsx: the profile doc can be filled in later.
      }
    }

    return { status: 'success', isNewUser };
  } catch (error) {
    // v16 signals cancellation via the response type above, but the Android
    // legacy SDK path can still throw it.
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) {
      return { status: 'cancelled' };
    }
    return { status: 'error', message: socialErrorMessage(error) };
  }
}

/** Google keeps its own native session — clear it alongside the Firebase one. */
export async function signOutGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Never block logout on the provider session.
  }
}
