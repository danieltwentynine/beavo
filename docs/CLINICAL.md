# Clinical and copy guidelines

Beavo is a children's health-adjacent app. Anything that reads as dental or medical advice needs clinical advisor review before shipping. Agents must **flag, not decide**.

## Hard rules for coach and child-facing copy
- Warm, short, encouraging. Max 2 sentences for coach messages.
- Never clinical language, diagnoses, or named dental conditions.
- Never scolding. Missed zones are framed as "next time" (orange, never red).
- No brand names. No medical advice (fluoride amounts, treatment, pain).
- Ages 4–7: playful analogies (sharks, robots, superheroes). Ages 8–12: slightly more mature.
- Copy must work for pre-readers (pair text with icons and visuals).

## Review process
1. Agent adds or changes copy → lists the changed strings in the PR description under "Needs clinical review".
2. Clinical advisor approves or edits.
3. Approved wording is recorded below.

## Awaiting review
- All child-facing strings in `lib/translations.ts` in English, Portuguese (BR) and Spanish: the `zone.*` guide hints, the `cheer.*` brushing cheers, the `coach.*` fallback messages and the `results.*` titles. The pt-BR and es versions were machine-written (2026-11-11) and have not been read by a native speaker.
- The Spanish and Portuguese terms added to the `BANNED` filter in `lib/gemini.ts` (caries, enfermedad, infec…, diagnóstic…, placa, gengivite, doutor).

## Approved wording
_None recorded yet. The advisor should add approved coach templates here (EN and PT-BR)._
