import type { ToothZone } from '@/types';

// Keep the model id in one place — Google retires models on a schedule
// (https://ai.google.dev/gemini-api/docs/deprecations).
const GEMINI_MODEL = 'gemini-3.5-flash-lite';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const TIMEOUT_MS = 4000;
const MAX_MESSAGE_CHARS = 300;
const MAX_ZONES_IN_PROMPT = 2;
const STREAK_MENTION_MIN_DAYS = 3;

/** Stands in for the child's name in the prompt and reply — the real name never leaves the device. */
export const NAME_TOKEN = '{NAME}';

export type CoachLocale = 'en' | 'pt-BR' | 'es';

const LANGUAGE_NAMES: Record<CoachLocale, string> = {
  en: 'English',
  'pt-BR': 'Brazilian Portuguese',
  es: 'Latin American Spanish',
};

export interface CoachInput {
  age: number;
  missedZones: ToothZone[];
  score: number;
  streakDays: number;
  locale?: CoachLocale;
}

const ZONE_PHRASES: Record<ToothZone, string> = {
  'top-front': 'the top front teeth',
  'top-left': 'the top left teeth',
  'top-right': 'the top right teeth',
  'top-back-left': 'the top back teeth on the left',
  'top-back-right': 'the top back teeth on the right',
  'bottom-front': 'the bottom front teeth',
  'bottom-left': 'the bottom left teeth',
  'bottom-right': 'the bottom right teeth',
  'bottom-back-left': 'the bottom back teeth on the left',
  'bottom-back-right': 'the bottom back teeth on the right',
};

// Medical/clinical or brand wording is a clinical-advisor call, so reject rather than rewrite.
const BANNED = /\b(cavit\w*|decay\w*|disease\w*|gingivitis|plaque|infect\w*|diagnos\w*|dentist\w*|doctor\w*|colgate|oral-b|crest|sensodyne|cárie\w*|doença\w*|dentista\w*|médic\w*|caries|enfermedad\w*|infec\w*|diagn[oó]stic\w*|placa|gengivite|doutor\w*)\b/i;

export function buildCoachPrompt({ age, missedZones, score, streakDays, locale = 'en' }: CoachInput): string {
  const tone =
    age <= 7
      ? 'The child is 4-7: use a fun analogy (a shark, a robot, a superhero) and very simple words.'
      : 'The child is 8-12: be upbeat but a little more grown-up, no baby talk.';
  const missed = missedZones
    .slice(0, MAX_ZONES_IN_PROMPT)
    .map((z) => ZONE_PHRASES[z])
    .join(' and ');
  const zoneLine = missed
    ? `Gently mention they can give ${missed} extra love next time.`
    : 'They brushed every area, so celebrate that.';
  const streakLine =
    streakDays >= STREAK_MENTION_MIN_DAYS ? `Cheer their ${streakDays}-day brushing streak.` : '';
  const language = LANGUAGE_NAMES[locale];

  return [
    `Write a coaching message in ${language} for a child who just brushed their teeth. Their name is ${NAME_TOKEN}; write ${NAME_TOKEN} exactly like that.`,
    `Score: ${score} out of 100. ${tone}`,
    zoneLine,
    streakLine,
    'Rules: at most 2 short sentences and under 30 words total, encouraging, never scolding, no medical or dental-health claims, no brand names, no emojis. Reply with the message only.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Turns a raw model reply into a safe message for `childName`, or null if it can't be trusted. */
export function sanitizeCoachReply(raw: string, childName: string): string | null {
  const cleaned = raw.replace(/[*_`#>]/g, '').replace(/^["'“”]+|["'“”]+$/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned || BANNED.test(cleaned)) return null;

  const twoSentences = (cleaned.match(/[^.!?]+[.!?]+/g) ?? [cleaned]).slice(0, 2).join('').trim();
  if (!twoSentences || twoSentences.length > MAX_MESSAGE_CHARS) return null;

  return twoSentences.split(NAME_TOKEN).join(childName.trim() || 'friend');
}

/** The Gemini coach message, or null on any failure — the caller falls back to `lib/coach.ts`. */
export async function generateCoachMessage(childName: string, input: CoachInput): Promise<string | null> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildCoachPrompt(input) }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 200 },
      }),
    });
    if (!response.ok) return null;
    const json: unknown = await response.json();
    const text = extractText(json);
    return text ? sanitizeCoachReply(text, childName) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractText(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) return null;
  const candidates = (json as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return null;
  const parts = (candidates[0] as { content?: { parts?: unknown } } | undefined)?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('');
  return text || null;
}
