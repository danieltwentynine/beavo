import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocsFromServer,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { z } from 'zod';

import type { Locale, UserProfile } from '@/types';

import { CHILD_SUBCOLLECTIONS, childrenRef, deleteChild } from './children.ts';
import { date, deleteCollection, toPlain } from './firestore.ts';
import { categoriesRef } from './toothEvents.ts';

export const userRef = (db: Firestore, uid: string) => doc(db, 'users', uid);

const userSchema = z.object({
  displayName: z.string(),
  locale: z.enum(['pt-BR', 'en']),
  createdAt: date,
  consent: z
    .object({ termsVersion: z.string(), privacyVersion: z.string(), acceptedAt: date })
    .optional(),
});

/**
 * The parent's profile from the server, or null when it doesn't exist yet.
 * Throws when offline — callers must tell "no profile" apart from "can't tell".
 * Malformed docs read as null so the parent is simply asked to consent again.
 */
export async function fetchUserProfile(db: Firestore, uid: string): Promise<UserProfile | null> {
  const snap = await getDocFromServer(userRef(db, uid));
  if (!snap.exists()) return null;
  const parsed = userSchema.safeParse(snap.data());
  return parsed.success ? parsed.data : null;
}

export interface ConsentInput {
  displayName: string;
  locale: Locale;
  termsVersion: string;
  privacyVersion: string;
  /** Keep the original account date when re-consenting. */
  createdAt?: Date;
}

/**
 * Record the accepted document versions. Writes the whole doc (no merge), which
 * also drops fields the schema no longer has (older builds stored the email).
 */
export function saveConsent(db: Firestore, uid: string, input: ConsentInput): Promise<void> {
  const now = Timestamp.now();
  return setDoc(userRef(db, uid), {
    displayName: input.displayName,
    locale: input.locale,
    createdAt: input.createdAt ? Timestamp.fromDate(input.createdAt) : now,
    consent: { termsVersion: input.termsVersion, privacyVersion: input.privacyVersion, acceptedAt: now },
  });
}

type Plain = Record<string, unknown>;

export interface DataExport {
  exportedAt: string;
  user: Plain | null;
  categories: Plain[];
  children: (Plain & Record<(typeof CHILD_SUBCOLLECTIONS)[number], Plain[]>)[];
}

/** Everything stored for this parent, as plain JSON. Needs a connection (server reads only). */
export async function exportAllData(db: Firestore, uid: string): Promise<DataExport> {
  const plainDocs = async (ref: ReturnType<typeof collection>) =>
    (await getDocsFromServer(ref)).docs.map((d) => ({ id: d.id, ...(toPlain(d.data()) as Plain) }));

  const userSnap = await getDocFromServer(userRef(db, uid));
  const children = await Promise.all(
    (await getDocsFromServer(childrenRef(db, uid))).docs.map(async (c) => {
      const subs = await Promise.all(CHILD_SUBCOLLECTIONS.map((sub) => plainDocs(collection(c.ref, sub))));
      return {
        id: c.id,
        ...(toPlain(c.data()) as Plain),
        brushingSlots: subs[0],
        brushingSessions: subs[1],
        toothEvents: subs[2],
      };
    }),
  );
  return {
    exportedAt: new Date().toISOString(),
    user: userSnap.exists() ? (toPlain(userSnap.data()) as Plain) : null,
    categories: await plainDocs(categoriesRef(db, uid)),
    children,
  };
}

/**
 * Delete everything under users/{uid}: the profile doc, each child with its
 * subcollections, then the categories. Needs a connection. Deleting the Auth
 * user is the caller's job, after this succeeds.
 */
export async function deleteAllUserData(db: Firestore, uid: string): Promise<void> {
  // Profile first: without consent the rules refuse new children and categories.
  await deleteDoc(userRef(db, uid));
  const children = await getDocsFromServer(childrenRef(db, uid));
  for (const c of children.docs) await deleteChild(db, uid, c.id);
  await deleteCollection(db, categoriesRef(db, uid));
}
