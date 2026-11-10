import { z } from 'zod';

import { isPrimaryTooth } from './teeth.ts';

/**
 * Backup file format = the "Export my data" JSON (account.ts exportAllData).
 * Importing reads it back: an untrusted file, so everything is re-validated
 * here and again by the security rules. Pure (no firebase) for `node --test`.
 */
export const BACKUP_FORMAT = 'beavo-backup';
export const BACKUP_VERSION = 1;

/** Generous family-scale limits: a file beyond them is not a real backup. */
const MAX = { categories: 200, children: 20, slots: 50, sessions: 30_000, toothEvents: 5_000 } as const;
/** Largest backup file we read (bytes). */
export const MAX_BACKUP_BYTES = 15 * 1024 * 1024;

// Real dates in a sane range (Firestore Timestamps can't hold extreme years).
const isoDate = z
  .string()
  .max(40)
  .refine((s) => {
    const t = Date.parse(s);
    return !Number.isNaN(t) && t >= Date.UTC(2000, 0, 1) && t <= Date.UTC(2100, 0, 1);
  })
  .transform((s) => new Date(s));
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
// Firestore forbids '/', '.', '..' and ids like __x__.
const docId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[^/]+$/)
  .refine((id) => id !== '.' && id !== '..' && !/^__.*__$/.test(id));

const slotSchema = z
  .object({
    id: docId,
    label: z.string().min(1).max(40),
    icon: z.string().min(1).max(30),
    mealType: z.enum(['breakfast', 'lunch', 'dinner', 'custom']),
    windowStart: hhmm,
    windowEnd: hhmm,
    sortOrder: z.number().int().min(0),
    createdAt: isoDate,
    archivedAt: isoDate.nullish().transform((d) => d ?? null),
  })
  .refine((s) => s.windowStart < s.windowEnd);

const sessionSchema = z.object({
  id: docId,
  slotId: z.string().min(1).max(128),
  date: ymd,
  startedAt: isoDate,
  durationSec: z.number().int().min(0).max(3600),
  completed: z.boolean(),
});

const toothEventSchema = z.object({
  id: docId,
  fdi: z.number().int().refine(isPrimaryTooth),
  type: z.enum(['symptom', 'treatment']),
  categoryId: z.string().min(1).max(128),
  note: z.string().max(500),
  date: ymd,
});

const childSchema = z.object({
  id: docId,
  name: z.string().min(1).max(40),
  avatarColor: hex,
  avatarIcon: z.string().min(1).max(30),
  birthYear: z
    .number()
    .int()
    .min(1990)
    .max(2100)
    .nullish()
    .transform((v) => v ?? null),
  kidMode: z.boolean(),
  createdAt: isoDate,
  archivedAt: isoDate.nullish().transform((d) => d ?? null),
  brushingSlots: z.array(slotSchema).max(MAX.slots),
  brushingSessions: z.array(sessionSchema).max(MAX.sessions),
  toothEvents: z.array(toothEventSchema).max(MAX.toothEvents),
});

const categorySchema = z.object({
  id: docId,
  name: z.string().min(1).max(40),
  type: z.enum(['symptom', 'treatment']),
  color: hex,
  isDefault: z.boolean(),
});

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  categories: z.array(categorySchema).max(MAX.categories),
  children: z.array(childSchema).max(MAX.children),
});

export type Backup = z.output<typeof backupSchema>;
export type BackupChild = Backup['children'][number];

/**
 * Parse a backup file. Returns null for anything that isn't a valid Beavo
 * backup (bad JSON, other app, newer version, malformed record) — all or
 * nothing, so a half-valid file never half-imports. Children that were being
 * deleted when exported (archived) are left out.
 */
export function parseBackup(text: string): Backup | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) return null;
  return { ...parsed.data, children: parsed.data.children.filter((c) => c.archivedAt === null) };
}
