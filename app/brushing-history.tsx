import { router } from 'expo-router';
import { ArrowLeft } from 'phosphor-react-native';
import { FlatList, Pressable, Text, View } from 'react-native';

import { SlotIcon } from '@/components/brushing/SlotIcon';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { useActiveChild } from '@/hooks/useActiveChild';
import { useSessions } from '@/hooks/useSessions';
import { t } from '@/lib/i18n';
import { tokens } from '@/lib/tokens';
import { sessionsNewestFirst } from '@/src/data/progress';

const formatWhen = (d: Date) =>
  `${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
const formatDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** Every brushing session of the active child, newest first. Archived slots keep their names. */
export default function BrushingHistoryScreen() {
  const { slots } = useActiveChild();
  const sessions = sessionsNewestFirst(useSessions());
  const slotById = new Map(slots.map((s) => [s.id, s]));

  return (
    <SafeScreen>
      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: 20, paddingTop: 4, rowGap: 12 }}
        ListHeaderComponent={
          <View style={{ rowGap: 8, marginBottom: 4 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('event.back')} onPress={() => router.back()} style={{ width: 48, height: 48, justifyContent: 'center' }}>
              <ArrowLeft size={26} color={tokens.textSecondary} weight="bold" />
            </Pressable>
            <Text className="font-display" style={{ fontSize: 28, color: tokens.textPrimary }}>
              {t('brushHistory.title')}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text className="font-body" style={{ fontSize: 16, color: tokens.textSecondary }}>
            {t('brushHistory.empty')}
          </Text>
        }
        renderItem={({ item: s }) => {
          const slot = slotById.get(s.slotId);
          const status = s.completed ? t('brushHistory.completed') : t('brushHistory.stopped');
          return (
            <Card
              padding={14}
              style={{ flexDirection: 'row', alignItems: 'center', columnGap: 12 }}
              accessibilityLabel={`${slot?.label ?? t('brushHistory.unknownSlot')}, ${formatWhen(s.startedAt)}, ${formatDuration(s.durationSec)}, ${status}`}
            >
              <SlotIcon icon={slot?.icon ?? 'tooth'} size={26} color={tokens.textPrimary} weight="fill" />
              <View style={{ flex: 1, rowGap: 2 }}>
                <Text className="font-display-semi" style={{ fontSize: 16, color: tokens.textPrimary }}>
                  {slot?.label ?? t('brushHistory.unknownSlot')}
                </Text>
                <Text className="font-body" style={{ fontSize: 14, color: tokens.textSecondary }}>
                  {formatWhen(s.startedAt)} · {formatDuration(s.durationSec)}
                </Text>
              </View>
              <Badge label={status} tone={s.completed ? 'cobalt' : 'warning'} solid={s.completed} />
            </Card>
          );
        }}
      />
    </SafeScreen>
  );
}
