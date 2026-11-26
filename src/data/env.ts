import { z } from 'zod';

/**
 * Schema of the public build-time config (EXPO_PUBLIC_*). Pure, for node --test;
 * lib/env.ts feeds it the inlined values at startup. Errors name the missing
 * keys only, never values.
 */
const required = z.string().trim().min(1);

const envSchema = z.object({
  EXPO_PUBLIC_FIREBASE_API_KEY: required,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: required,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: required,
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: required,
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: required,
  EXPO_PUBLIC_FIREBASE_APP_ID: required,
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: required,
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: required,
});

export type PublicEnv = z.infer<typeof envSchema>;

/** Validate a raw env object; throws an Error naming only the missing or empty keys. */
export function parsePublicEnv(raw: Record<string, string | undefined>): PublicEnv {
  const parsed = envSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const missing = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
  throw new Error(`Beavo config is incomplete. Missing or empty: ${missing.join(', ')}. See .env.example and the EAS environment in eas.json.`);
}
