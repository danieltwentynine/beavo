import { router } from 'expo-router';
import { ArrowLeft } from 'phosphor-react-native';
import { useMemo } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { formatEventDate, toothName } from '@/components/teeth/toothName';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { useCategories } from '@/hooks/useCategories';
import { useToothEvents } from '@/hooks/useToothEvents';
import { t } from '@/lib/i18n';
import { tokens } from '@/lib/tokens';
import { newestFirst } from '@/src/data/teeth';

/** All tooth events of the active child, newest first. Tapping one opens its tooth. */
export default function DentalHistoryScreen() {
  const events = useToothEvents();
  const categories = useCategories();
  const sorted = useMemo(() => newestFirst(events), [events]);
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? '';

  return (
    <SafeScreen>
      <FlatList
        data={sorted}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: 20, paddingTop: 4, rowGap: 12 }}
        ListHeaderComponent={
          <View style={{ rowGap: 8, marginBottom: 4 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('event.back')}
              onPress={() => router.back()}
              style={{ width: 48, height: 48, justifyContent: 'center' }}
            >
              <ArrowLeft size={26} color={tokens.textSecondary} weight="bold" />
            </Pressable>
            <Text className="font-display" style={{ fontSize: 28, color: tokens.textPrimary }}>
              {t('history.title')}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text className="font-body" style={{ fontSize: 16, color: tokens.textSecondary }}>
            {t('history.empty')}
          </Text>
        }
        renderItem={({ item: e }) => (
          <Card
            padding={14}
            onPress={() => router.push({ pathname: '/tooth-sheet', params: { teeth: String(e.fdi) } })}
            accessibilityLabel={`${toothName(e.fdi)}, ${t(e.type === 'symptom' ? 'event.symptom' : 'event.treatment')}, ${categoryName(e.categoryId)}, ${formatEventDate(e.date)}`}
            style={{ rowGap: 4 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
              <Badge label={t(e.type === 'symptom' ? 'event.symptom' : 'event.treatment')} tone={e.type === 'symptom' ? 'warning' : 'cobalt'} />
              <Text className="font-body-semi" style={{ fontSize: 14, color: tokens.textSecondary }}>
                {formatEventDate(e.date)}
              </Text>
            </View>
            <Text className="font-display-semi" style={{ fontSize: 17, color: tokens.textPrimary }}>
              {toothName(e.fdi)}
            </Text>
            <Text className="font-body" style={{ fontSize: 15, color: tokens.textSecondary }}>
              {[categoryName(e.categoryId), e.note].filter(Boolean).join(' · ')}
            </Text>
          </Card>
        )}
      />
    </SafeScreen>
  );
}
