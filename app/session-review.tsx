import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'phosphor-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { SlotIcon } from '@/components/brushing/SlotIcon';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { useActiveChild } from '@/hooks/useActiveChild';
import { useSessions } from '@/hooks/useSessions';
import { t } from '@/lib/i18n';
import { colors } from '@/lib/tokens';
import { formatDuration, formatWhen } from '@/src/data/progress';

/**
 * One saved brushing session of the active child, opened from Brushing History.
 * Shows what is saved (slot, start, length, finished or stopped early). The
 * results screen's score and zone map are not saved, so they are not shown here.
 */
export default function SessionReviewScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { slots } = useActiveChild();
  const session = useSessions().find((s) => s.id === id);
  const slot = session ? slots.find((s) => s.id === session.slotId) : undefined;

  return (
    <SafeScreen>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, rowGap: 16 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('event.back')} onPress={() => router.back()} style={{ width: 48, height: 48, justifyContent: 'center' }}>
          <ArrowLeft size={26} color={colors.inkMuted} weight="bold" />
        </Pressable>

        {session ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 12 }}>
              <SlotIcon icon={slot?.icon ?? 'tooth'} size={32} color={colors.ink} weight="fill" />
              <View style={{ flex: 1 }}>
                <Text accessibilityRole="header" className="font-display" style={{ fontSize: 28, color: colors.ink }}>
                  {slot?.label ?? t('brushHistory.unknownSlot')}
                </Text>
                <Text className="font-body" style={{ fontSize: 16, color: colors.inkMuted }}>
                  {formatWhen(session.startedAt)}
                </Text>
              </View>
            </View>

            <Card padding={20} style={{ alignItems: 'center', rowGap: 10 }}>
              <Text className="font-body-semi" style={{ fontSize: 16, color: colors.inkMuted }}>
                {t('sessionReview.duration')}
              </Text>
              <Text className="font-numeric" style={{ fontSize: 56, lineHeight: 72, color: colors.ink }}>
                {formatDuration(session.durationSec)}
              </Text>
              <Badge
                label={session.completed ? t('brushHistory.completed') : t('brushHistory.stopped')}
                tone={session.completed ? 'primary' : 'neutral'}
                solid={session.completed}
              />
              <Text className="font-body" style={{ fontSize: 16, color: colors.ink, textAlign: 'center' }}>
                {session.completed ? t('sessionReview.completedBody') : t('sessionReview.stoppedBody')}
              </Text>
            </Card>
          </>
        ) : (
          <Text className="font-body" style={{ fontSize: 16, color: colors.inkMuted }}>
            {t('sessionReview.missing')}
          </Text>
        )}
      </ScrollView>
    </SafeScreen>
  );
}
