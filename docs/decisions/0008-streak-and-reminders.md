# 0008. Daily streak, silent freeze, bridge, and local reminders

- Status: Accepted (owner, 2026-11-27: PLANO v3 + Vex v3 conditions, OpenBot/Shared/beavo-reminders)
- Date: 2026-11-27

## Context
The owner asked for brushing reminders, a daily streak, a "freeze" given as a random gift, and a way to repair a broken streak, for children aged 4–12, while keeping it kind: no countdowns, no guilt, nothing that pushes the child to open the app. Random rewards and streak pressure are flagged risks (ECA Digital; lawyer review at the end of the roadmap).

## Decision
1. **Streak (`src/data/streak.ts`), derived from sessions only — nothing stored, synced, backed up or deleted separately.**
   - A streak day is a local date with a saved session that ran (`durationSec > 0`, early stops included); one per date; +1 each.
   - Today without brushing is pending: it never breaks the trail.
   - **Bridge (repair "C")**: the next streak day joins the trail across up to **3** whole local days without brushing; those days add 0. A longer gap starts a new trail at 1; the best streak is kept. No prompt, deadline or invitation.
   - **Freeze ("gelinho")**: after a streak day, a seeded draw `hash("beavo-gift-v1"|childId|date) < 1/7`, guaranteed by the **10th** eligible day, at most **2** held (no draw at the cap). A held freeze is used by itself on the next past day without brushing while the trail is alive; that day is an ice stone and adds 0. No expiry. Silent: the child UI never shows the draw, the gift or the stock.
   - The dam counts real streak days only.
   - The rules and the seed are frozen (golden tests). A change needs a cutover date so past trails never change.
   - The weekly badge and week dots keep the "all slots completed" day.
   - **The record never goes down** (Vex build review): freezes are a pool spent in date order, so a back-dated brushing that syncs late can, rarely (~0.2% of random late arrivals in fuzzing), shorten a past trail in the recomputation. Rule tweaks didn't remove it without changing the owner's design, so "Maior trilha" is floored by the highest value this device already showed (`settingsStore.bestTrail`, a number per child id, device-only, cleared with the owner and with a deleted child). `hooks/useStreakSummary.ts` applies it.
2. **Reminders: local notifications only (`expo-notifications`).**
   - No push server, no push token. expo-notifications 57.0.x always adds the APNs entitlement, so `plugins/withoutPushEntitlement.js` removes it; the introspected iOS entitlements are `{}`.
   - Planned by `src/data/reminders.ts` as one-shot reminders 7 days ahead, one per slot at its time (default: window start, or the end of quiet hours 21:00–07:00), skipped when the device knows that slot was brushed, at most 3 a day for the device (siblings merged). Ids carry the IANA zone, so a zone change replaces them all. They stop by themselves when the app isn't opened for a week.
   - The daily cap holds across re-plans: a device-only log of the times already scheduled (today and later, no child data) counts today's past times against the budget. A time moved by DST is re-checked in its real local time (quiet hours, slot window) and dropped if it fails.
   - Clearing tries each cancellation, falls back to cancelling all (Beavo schedules only reminders), clears delivered ones, and stays pending (retried at launch and foreground, before any new plan) until nothing of ours is left. A plan never schedules on top of a failed cancellation.
   - Neutral text (`reminders.notificationBody`), payload `{ kind: 'reminder' }` only; a tap opens Escovação without starting a session. No badge, no sound while the app is open.
   - Settings live on the device (`settingsStore.reminders`, keyed to the owner); a sign-out, another owner, erased device data or account deletion cancels every reminder, clears delivered ones and resets the settings. A deleted child leaves the plan and its preferences are dropped.
3. **Opt-in.** Off by default. Offered once to an adult (an owner with a child, not in kid mode — it waits for an adult otherwise). "Quero lembretes" runs through the parental gate before the system prompt or any scheduling, even with the permission already granted; `enableReminders(stillAllowed)` re-checks the context after every await. "Agora não" is ungated and ends automatic offers **for this device**: the answer survives sign-out, restarts and another sign-in (no account id is kept for it); Adultos → Lembretes stays available.

## Alternatives considered
- Push notifications from a server: needs a stored push token (a persistent identifier under COPPA), a sender and token deletion — rejected.
- A repeating daily trigger: can't skip a slot already brushed without background code — rejected for one-shot reminders.
- Truly random gifts stored per child: needs a synced ledger, rules, backup and deletion, can race between devices and can't be audited — rejected for the seeded draw.
- Parent-marked repairs (`streakRepairs` collection): new child-linked data with rules, backup and retention — not chosen (owner chose C).
- "2 of the next 3 days" repair: vetoed by Vex (hidden deadline).

## Consequences
- Existing testers' streaks change (daily rule instead of all slots).
- A new native module: the dev client and EAS builds must be rebuilt.
- Delivery is best effort (iOS may delay; Android Doze; after a reboot or zone change until the app is next opened) — device tests pending.
- Still for the lawyer: ECA Digital arts. 10 and 17 for a free random gift and streaks, whether local reminders count as notifications, the privacy-policy line about local reminders.
