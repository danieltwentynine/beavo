import { router } from 'expo-router';
import { ArrowLeft } from 'phosphor-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { locale, t } from '@/lib/i18n';
import { tokens } from '@/lib/tokens';
import { BRUSHING_DURATIONS, useSettingsStore } from '@/stores/settingsStore';

/** Device settings (parent-only: reached through the gate in More). */
export default function SettingsScreen() {
  const duration = useSettingsStore((s) => s.brushingDurationSec);
  const setDuration = useSettingsStore((s) => s.setBrushingDuration);

  return (
    <SafeScreen>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, rowGap: 16 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('event.back')} onPress={() => router.back()} style={{ width: 48, height: 48, justifyContent: 'center' }}>
          <ArrowLeft size={26} color={tokens.textSecondary} weight="bold" />
        </Pressable>
        <Text className="font-display" style={{ fontSize: 28, color: tokens.textPrimary }}>
          {t('settings.title')}
        </Text>
        <Card padding={16} style={{ rowGap: 12 }}>
          <Text className="font-display-semi" style={{ fontSize: 18, color: tokens.textPrimary }}>
            {t('settings.duration')}
          </Text>
          <Text className="font-body" style={{ fontSize: 14, color: tokens.textSecondary }}>
            {t('settings.durationHint')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {BRUSHING_DURATIONS.map((sec) => (
              <Chip
                key={sec}
                label={t('settings.minutes', { value: (sec / 60).toLocaleString(locale, { maximumFractionDigits: 1 }) })}
                selected={duration === sec}
                onPress={() => setDuration(sec)}
                style={{ flexGrow: 1 }}
              />
            ))}
          </View>
        </Card>
      </ScrollView>
    </SafeScreen>
  );
}
