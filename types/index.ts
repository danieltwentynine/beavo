export type ToothZone =
  | 'top-front'
  | 'top-left'
  | 'top-right'
  | 'top-back-left'
  | 'top-back-right'
  | 'bottom-front'
  | 'bottom-left'
  | 'bottom-right'
  | 'bottom-back-left'
  | 'bottom-back-right';

export type BadgeType = 'streak' | 'perfect' | 'firstSession' | 'weeklyGoal';

export type Locale = 'pt-BR' | 'en' | 'es';

export interface Consent {
  termsVersion: string;
  privacyVersion: string;
  acceptedAt: Date;
}

/** users/{uid} — the parent. Children never have accounts. */
export interface UserProfile {
  displayName: string;
  locale: Locale;
  createdAt: Date;
  consent?: Consent;
}

/** users/{uid}/children/{childId} */
export interface Child {
  id: string;
  name: string;
  avatarColor: string;
  avatarIcon: string;
  birthYear?: number;
  kidMode: boolean;
  createdAt: Date;
  archivedAt?: Date;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'custom';

/** users/{uid}/children/{childId}/brushingSlots/{slotId}. Times are local "HH:mm". */
export interface BrushingSlot {
  id: string;
  label: string;
  icon: string;
  mealType: MealType;
  windowStart: string;
  windowEnd: string;
  sortOrder: number;
  createdAt: Date;
  archivedAt?: Date;
}

/** users/{uid}/children/{childId}/brushingSessions/{sessionId}. `date` is local YYYY-MM-DD. */
export interface BrushingSession {
  id: string;
  slotId: string;
  date: string;
  startedAt: Date;
  durationSec: number;
  completed: boolean;
}

export type ToothEventType = 'symptom' | 'treatment';

/** users/{uid}/children/{childId}/toothEvents/{eventId}. `fdi` is the FDI tooth number. */
export interface ToothEvent {
  id: string;
  fdi: number;
  type: ToothEventType;
  categoryId: string;
  note: string;
  date: string;
}

/** users/{uid}/categories/{categoryId} */
export interface Category {
  id: string;
  name: string;
  type: ToothEventType;
  color: string;
  isDefault: boolean;
}
