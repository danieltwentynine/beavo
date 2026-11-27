import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import { t } from '@/lib/i18n';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  REMINDER_ID_PREFIX,
  REMINDER_PAYLOAD,
  applyReminderPlan,
  clearReminders,
  dismissDelivered,
  withPendingFlag,
  enableAfterGate,
  type EnableResult,
  type NotificationPort,
  type PermissionState,
  type PlannedReminder,
} from '@/src/data/reminders';

/**
 * The native side of brushing reminders: expo-notifications with LOCAL
 * notifications only (app.json: enableRemoteNotifications false, so there is
 * no APNs entitlement and no push token is ever requested). The plan comes
 * from src/data/reminders.ts; hooks/useReminderSync.ts decides when to apply it.
 */

const CHANNEL_ID = 'reminders';

let configured = false;

/** Once per launch: how reminders show while the app is open, and the Android channel. */
export function configureReminders(): void {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    // With the app open the adult is already here: no banner or sound, only Notification Center.
    handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    // Android 13+ only shows the permission prompt once a channel exists.
    void Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: t('reminders.title'),
      importance: Notifications.AndroidImportance.DEFAULT,
      showBadge: false,
      enableVibrate: false,
    }).catch(() => undefined);
  }
}

const isOurs = (id: string) => id.startsWith(REMINDER_ID_PREFIX);

/** expo-notifications behind the port the planner uses. */
export const notificationPort: NotificationPort = {
  scheduledIds: async () => (await Notifications.getAllScheduledNotificationsAsync()).map((r) => r.identifier),
  schedule: async (reminder: PlannedReminder) => {
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: {
        title: 'Beavo',
        // Fixed and neutral (Vex): no child name, count, health, streak or invitation.
        body: t('reminders.notificationBody'),
        data: { ...REMINDER_PAYLOAD },
        sound: 'default',
        interruptionLevel: 'active',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.fireAt, channelId: CHANNEL_ID },
    });
  },
  cancel: (id) => Notifications.cancelScheduledNotificationAsync(id),
  // Beavo schedules nothing but reminders, so "all" is only ours.
  cancelAll: () => Notifications.cancelAllScheduledNotificationsAsync(),
  dismissDelivered: async () => {
    let failed = false;
    for (const n of await Notifications.getPresentedNotificationsAsync()) {
      if (!isOurs(n.request.identifier)) continue;
      await Notifications.dismissNotificationAsync(n.request.identifier).catch(() => {
        failed = true;
      });
    }
    if (failed) await Notifications.dismissAllNotificationsAsync();
  },
};

// One change at a time, in order, so two quick re-plans never interleave.
let queue: Promise<unknown> = Promise.resolve();
const serial = <T>(work: () => Promise<T>): Promise<T> => {
  const next = queue.catch(() => undefined).then(work);
  queue = next;
  return next;
};

/** Make this phone's pending reminders match `plan`. Never throws; false = something failed (the next re-plan retries). */
export const applyPlan = (plan: readonly PlannedReminder[]): Promise<boolean> =>
  serial(async () => {
    if ((await applyReminderPlan(notificationPort, plan)).ok) return true;
    // A cancellation failed: wipe ours (falls back to cancel-all), then schedule the plan on a clean slate.
    if (!(await clearReminders(notificationPort))) return false;
    return (await applyReminderPlan(notificationPort, plan)).ok;
  }).catch(() => false);

/** Remove our delivered reminders from Notification Center (a child profile was deleted). Never throws. */
// Pending until it works: useReminderSync retries at the next launch or foreground.
export const dismissDeliveredReminders = (): Promise<boolean> =>
  withPendingFlag(() => serial(() => dismissDelivered(notificationPort)), useSettingsStore.getState().setReminderDismissPending);

/**
 * Cancel every pending reminder and clear delivered ones. Never throws. While it
 * hasn't fully worked, `reminderCleanupPending` stays set and useReminderSync
 * retries at the next launch or foreground, before planning anything new.
 */
export const clearAllReminders = (): Promise<boolean> =>
  withPendingFlag(() => serial(() => clearReminders(notificationPort)), useSettingsStore.getState().setReminderCleanupPending);

function toState(status: Notifications.NotificationPermissionsStatus): PermissionState {
  const ios = status.ios?.status;
  if (ios === Notifications.IosAuthorizationStatus.PROVISIONAL || ios === Notifications.IosAuthorizationStatus.EPHEMERAL) return 'granted';
  if (status.granted) return 'granted';
  return status.status === 'undetermined' && status.canAskAgain !== false ? 'undetermined' : 'denied';
}

/** The system permission now (asks nothing). 'denied' = only the Settings app can turn it on. */
export async function reminderPermission(): Promise<PermissionState> {
  try {
    return toState(await Notifications.getPermissionsAsync());
  } catch {
    return 'denied';
  }
}

async function requestReminderPermission(): Promise<PermissionState> {
  try {
    return toState(await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } }));
  } catch {
    return 'denied';
  }
}

/**
 * "Quero lembretes" / the Lembretes switch, AFTER the parental gate passed
 * (wrap the call in requireParent, even when the permission already exists).
 * The system prompt shows only if it was never answered. 'on': the default
 * times are scheduled by useReminderSync. 'denied': everything stays off.
 * `stillAllowed` (owner, consent, active child, not kid mode) is re-checked
 * before the prompt and after it: 'cancelled' means nothing was saved.
 */
export function enableReminders(stillAllowed?: () => boolean): Promise<EnableResult> {
  const settings = useSettingsStore.getState();
  return enableAfterGate({
    permission: reminderPermission,
    request: requestReminderPermission,
    setEnabled: settings.setRemindersEnabled,
    markOfferDone: settings.markReminderOfferDone,
    stillAllowed,
  });
}

/** "Agora não": no gate, no prompt, no scheduling, and no automatic offer again. */
export function declineReminderOffer(): void {
  useSettingsStore.getState().markReminderOfferDone();
}

/** Turn every reminder off on this phone (the next sync cancels them). */
export function disableReminders(): void {
  useSettingsStore.getState().setRemindersEnabled(false);
}

/** The app's page in the system Settings (for a blocked permission). */
export const openNotificationSettings = (): Promise<void> => Linking.openSettings();

/** True for a tap on one of our reminders. */
export const isReminderResponse = (response: Notifications.NotificationResponse | null | undefined): boolean =>
  !!response && isOurs(response.notification.request.identifier) && response.notification.request.content.data?.kind === REMINDER_PAYLOAD.kind;
