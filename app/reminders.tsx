import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';

import { RemindersPanel, type ReminderRow } from '@/components/reminders/RemindersPanel';
import { canManageReminders, hasReminderSettingsAccess, revokeReminderSettingsAccess } from '@/components/reminders/reminderAudience';
import { useActiveChild } from '@/hooks/useActiveChild';
import { t } from '@/lib/i18n';
import { disableReminders, enableReminders, openNotificationSettings, reminderPermission } from '@/lib/reminders';
import { clampToWindow, inQuietHours, prefKey, slotReminderRows, type PermissionState } from '@/src/data/reminders';
import { currentSlots } from '@/src/data/schedule';
import { STREAK_RULES } from '@/src/data/streak';
import { ownerIdOf, useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';

export default function RemindersScreen() {
  const owner = useAuthStore(ownerIdOf);
  const { child, slots } = useActiveChild();
  const settings = useSettingsStore((state) => state.reminders);
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    const refresh = async () => {
      try {
        const status = await reminderPermission();
        if (active) setPermission(status);
      } catch {
        if (active) setError(true);
      }
    };
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []));

  useEffect(() => {
    return () => {
      if (owner && child?.id) revokeReminderSettingsAccess(owner, child.id);
    };
  }, [owner, child?.id]);

  if (!owner || !child || !hasReminderSettingsAccess(owner, child.id)) return <Redirect href="/(tabs)/brushing" />;

  const ownerId = owner;
  const childId = child.id;
  const canProceed = () => canManageReminders(ownerId, childId) && hasReminderSettingsAccess(ownerId, childId);
  const quiet = settings.quiet;
  const statusById = new Map(slotReminderRows(childId, slots, settings).map((entry) => [entry.slotId, entry]));
  const rows: ReminderRow[] = currentSlots(slots).map((slot) => {
    const pref = settings.prefs[prefKey(childId, slot.id)];
    const status = statusById.get(slot.id);
    const time = status?.time ?? (pref?.time ? clampToWindow(pref.time, slot) : status?.defaultTime ?? slot.windowStart);
    return {
      id: slot.id,
      label: slot.label,
      icon: slot.icon,
      enabled: settings.enabled && (pref?.on ?? true),
      time,
      blockedByQuiet: status?.quietBlocked,
      validateTime: (value) => value < slot.windowStart || value > slot.windowEnd
        ? 'reminders.windowError'
        : inQuietHours(value, quiet) ? 'reminders.quietConflict' : undefined,
    };
  });

  async function update(action: () => Promise<void> | void) {
    if (pending.current || !canProceed()) return;
    pending.current = true;
    setBusy(true);
    setError(false);
    try {
      await action();
    } catch {
      setError(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function changeEnabled(enabled: boolean) {
    if (!enabled) {
      void update(disableReminders);
      return;
    }
    const enable = () => void update(async () => {
      const result = await enableReminders(canProceed);
      if (result !== 'cancelled' && canProceed()) setPermission(await reminderPermission());
    });
    if (permission === 'undetermined') {
      Alert.alert(t('reminders.offerTitle'), t('reminders.offerBody'), [
        { text: t('reminders.offerDecline'), style: 'cancel' },
        { text: t('reminders.offerAccept'), onPress: enable },
      ]);
    } else if (permission === 'granted') {
      enable();
    }
  }

  return (
    <RemindersPanel rows={rows} permission={permission} enabled={settings.enabled} quiet={quiet}
      trailExplanation={t('reminders.trailBody', {
        name: child.name,
        odds: Math.round(1 / STREAK_RULES.giftChance),
        guarantee: STREAK_RULES.giftGuaranteeDays,
        cap: STREAK_RULES.freezeCap,
        bridge: STREAK_RULES.bridgeDays,
      })}
      busy={busy} error={error ? t('reminders.updateError') : undefined}
      onBack={() => router.back()}
      onOpenSettings={() => void update(openNotificationSettings)}
      onToggleEnabled={changeEnabled}
      onToggle={(id, on) => void update(() => {
        const key = prefKey(childId, id);
        const previous = useSettingsStore.getState().reminders.prefs[key];
        useSettingsStore.getState().setSlotReminder(childId, id, { on, time: previous?.time ?? null });
      })}
      onTime={(id, time) => void update(() => {
        const key = prefKey(childId, id);
        const previous = useSettingsStore.getState().reminders.prefs[key];
        useSettingsStore.getState().setSlotReminder(childId, id, { on: previous?.on ?? true, time });
      })}
      onQuietTime={(edge, time) => void update(() => {
        const previous = useSettingsStore.getState().reminders.quiet;
        useSettingsStore.getState().setQuietHours({ ...previous, [edge]: time });
      })}
    />
  );
}
