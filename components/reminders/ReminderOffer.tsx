import { Bell } from 'phosphor-react-native';
import { ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { locale, t } from '@/lib/i18n';
import { colors, radius } from '@/lib/tokens';
import { groupReminderPreview } from '@/src/data/reminderPreview';
import type { PlannedReminder } from '@/src/data/reminders';

const formatDate = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' });

export function ReminderOffer({ plan, previewFailed, onRetryPreview, busy, error, onAccept, onDecline }: {
  plan: readonly PlannedReminder[] | null;
  previewFailed: boolean;
  onRetryPreview: () => void;
  busy: boolean;
  error?: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const days = plan && groupReminderPreview(plan);
  return (
    <SafeScreen>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: 16, padding: 24,
        width: '100%', maxWidth: 520, alignSelf: 'center' }}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={{ alignSelf: 'flex-start', backgroundColor: colors.tileRoutine, borderRadius: radius.md, padding: 12 }}>
          <Bell size={28} color={colors.tileRoutineInk} weight="bold" />
        </View>
        <Text accessibilityRole="header" className="font-display" style={{ fontSize: 28, color: colors.ink }}>
          {t('reminders.offerTitle')}
        </Text>
        <Text className="font-body" style={{ fontSize: 16, lineHeight: 22, color: colors.inkMuted }}>
          {t('reminders.offerBody')}
        </Text>
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" className="font-body-semi" style={{ fontSize: 16, color: colors.ink }}>
            {t('reminders.offerTimes')}
          </Text>
          {days?.length ? days.map(({ day, date, times }) => (
            <Text key={day} className="font-body" style={{ fontSize: 16, color: colors.ink }}>
              {t('reminders.offerDayTimes', { date: formatDate.format(date), times: times.join(' · ') })}
            </Text>
          )) : (
            <Text accessibilityLiveRegion="polite" className="font-body" style={{ fontSize: 16, color: colors.inkMuted }}>
              {t(previewFailed ? 'reminders.offerPreviewError' : days ? 'reminders.offerNoTimes' : 'reminders.loading')}
            </Text>
          )}
          {previewFailed && <Button variant="outline" label={t('consent.retry')} onPress={onRetryPreview} />}
        </View>
        {error ? (
          <Text accessibilityLiveRegion="polite" className="font-body" style={{ fontSize: 16, color: colors.symptomInk }}>{error}</Text>
        ) : null}
        <Button variant="outline" label={t('reminders.offerAccept')} onPress={onAccept} loading={busy} disabled={!plan} />
        <Button variant="outline" label={t('reminders.offerDecline')} onPress={onDecline} disabled={busy} />
      </ScrollView>
    </SafeScreen>
  );
}
