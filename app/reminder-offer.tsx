import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';

import { ReminderOffer } from '@/components/reminders/ReminderOffer';
import { canManageReminders } from '@/components/reminders/reminderAudience';
import { useParentalGate } from '@/components/ui/ParentalGate';
import { useActiveChild } from '@/hooks/useActiveChild';
import { useReminderPreview } from '@/hooks/useReminderPreview';
import { t } from '@/lib/i18n';
import { declineReminderOffer, enableReminders } from '@/lib/reminders';
import { ownerIdOf, useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';

export default function ReminderOfferRoute() {
  const owner = useAuthStore(ownerIdOf);
  const consent = useAuthStore((state) => state.consent);
  const { child } = useActiveChild();
  const settings = useSettingsStore((state) => state.reminders);
  const preview = useReminderPreview(consent === 'ok' && child && !child.kidMode ? owner : null, settings);
  const { gate, requireParent } = useParentalGate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef(false);

  if (!owner || consent !== 'ok' || !child || child.kidMode) return <Redirect href="/(tabs)/brushing" />;

  const ownerId = owner;
  const childId = child.id;
  const canProceed = () => canManageReminders(ownerId, childId);

  async function finish(value: 'accept' | 'decline') {
    if (pending.current || !canProceed() || (value === 'accept' && !preview.plan)) return;
    pending.current = true;
    setBusy(true);
    setError(false);
    try {
      if (value === 'accept') {
        const result = await enableReminders(canProceed);
        if (result === 'cancelled' || !canProceed()) return;
      } else {
        declineReminderOffer();
      }
      router.back();
    } catch {
      setError(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const decline = () => finish('decline');

  return (
    <>
      <ReminderOffer
        plan={preview.plan}
        previewFailed={preview.failed}
        onRetryPreview={preview.retry}
        busy={busy}
        error={error ? t('reminders.updateError') : undefined}
        onAccept={() => requireParent(() => void finish('accept'))}
        onDecline={() => void decline()}
      />
      {gate}
    </>
  );
}
