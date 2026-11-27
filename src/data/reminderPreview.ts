import type { PlannedReminder } from './reminders.ts';

export interface ReminderPreviewDay {
  day: string;
  date: Date;
  times: string[];
}

/** Group the device plan for display without changing its dates or times. */
export function groupReminderPreview(plan: readonly PlannedReminder[]): ReminderPreviewDay[] {
  const days = new Map<string, ReminderPreviewDay>();
  for (const { day, fireAt } of plan) {
    const hours = String(fireAt.getHours()).padStart(2, '0');
    const minutes = String(fireAt.getMinutes()).padStart(2, '0');
    const time = `${hours}:${minutes}`;
    const row = days.get(day);
    if (row) row.times.push(time);
    else days.set(day, { day, date: fireAt, times: [time] });
  }
  return [...days.values()];
}
