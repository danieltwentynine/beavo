# Clinical and copy guidelines

Zing is a children's health-adjacent app. Anything that reads as dental or medical advice needs clinical advisor review before shipping. Agents must **flag, not decide**.

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

## Needs clinical review (2026-10-31, foundation step 1)
- Default tooth-event categories (`src/data/toothEvents.ts`, names in `lib/i18n.ts` `category.*`): Dor/Pain, Sensibilidade/Sensitivity, Sangramento/Bleeding, Restauração/Filling, Selante/Sealant, Limpeza/Cleaning, Extração/Extraction.
- Default brushing slots: "Depois do café da manhã / do almoço / do jantar" (After breakfast / lunch / dinner), windows 06–10, 11–15, 18–22.
- Terms of Service §2 "Zing is not medical advice" (`legal/terms.*.md`).
- Camera mirror explainer (`camera.*` in `lib/i18n.ts`, `locales/*.json`).

## Needs clinical review (2026-10-31, foundation step 2)
- Tooth names (`tooth.*` in `lib/i18n.ts`): "Incisivo central/lateral, Canino, Primeiro/Segundo molar + superior/inferior + direito/esquerdo" and the English equivalents.
- Chart perspective: dentist view (child's right on the screen's left) — confirm this matches how parents read dentists' reports.
- Status colors: symptom = warm orange, treatment = light sky blue (no red).
- Health wording in `lib/i18n.ts` (pt-BR + en): `overview.symptoms`/`overview.treatments`, `arch.status*`, `arch.legend*`, `arch.chartLabel` ("Mapa dos dentes de leite"), all `event.*` (e.g. "Registrar sintoma"), `history.*`, and the tab title `tabs.overview` ("Visão geral").

## Needs clinical review (2026-10-31, foundation step 3)
- `settings.durationHint`: "Dentistas recomendam 2 minutos." / "Dentists recommend 2 minutes." — a clinical claim; confirm wording. Duration choices: 1, 1.5, 2, 2.5, 3 min.
- Badge names (`badge.*`): Primeira escovação / Pegando fogo / Estrela da semana.
- Brushing History statuses: "Completa" / "Parou antes" (Completed / Stopped early).
- Streak rule shown to parents: a day counts only when every brushing time was completed.
- `badge.perfect` ("Escovação perfeita" / "Perfect Brush") — defined but not awarded (no scores).
- `categories.symptoms`/`categories.treatments`, `categories.deleteBody`.
- **Decision needed:** with the 1 or 1.5 min setting, a run that reaches the chosen length is saved as `completed` and counts for the streak, while the hint says dentists recommend 2 min. Should sub-2-minute runs count as complete?
- Not clinical: `more.premiumBody` / `premium.body` are placeholders and must be replaced before release.

## Approved wording
_None recorded yet. The advisor should add approved coach templates here (EN and PT-BR)._
