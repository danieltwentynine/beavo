import { router } from 'expo-router';
import { ArrowLeft } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { useParentalGate } from '@/components/ui/ParentalGate';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { locale, t } from '@/lib/i18n';
import { colors } from '@/lib/tokens';
import { BRUSHING_DURATIONS, useSettingsStore } from '@/stores/settingsStore';

/** Device settings (parent-only: reached through the gate in More). */
export default function SettingsScreen() {
  const duration = useSettingsStore((s) => s.brushingDurationSec);
  const setDuration = useSettingsStore((s) => s.setBrushingDuration);
  const hasPin = useSettingsStore((s) => s.parentPin !== null);
  // Choosing the PIN reuses the gate's "forgot the PIN" path: the phone's owner, then the new PIN twice.
  const { gate: choosePinGate, requireParent: choosePin } = useParentalGate('choosePin');
  const [pinSaved, setPinSaved] = useState(false);

  return (
    <SafeScreen>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, rowGap: 16 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('event.back')} onPress={() => router.back()} style={{ width: 48, height: 48, justifyContent: 'center' }}>
          <ArrowLeft size={26} color={colors.inkMuted} weight="bold" />
        </Pressable>
        <Text className="font-display" style={{ fontSize: 28, color: colors.ink }}>
          {t('settings.title')}
        </Text>
        <Card padding={16} style={{ rowGap: 12 }}>
          <Text className="font-display-semi" style={{ fontSize: 18, color: colors.ink }}>
            {t('settings.duration')}
          </Text>
          <Text className="font-body" style={{ fontSize: 16, color: colors.inkMuted }}>
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
        <Card padding={16} style={{ rowGap: 12 }}>
          <Text className="font-display-semi" style={{ fontSize: 18, color: colors.ink }}>
            {t('settings.pin')}
          </Text>
          <Text className="font-body" style={{ fontSize: 16, color: colors.inkMuted }}>
            {hasPin ? t('settings.pinSet') : t('settings.pinNone')}
          </Text>
          <Button
            label={hasPin ? t('settings.pinChange') : t('settings.pinCreate')}
            variant="soft"
            onPress={() => {
              setPinSaved(false);
              choosePin(() => setPinSaved(true));
            }}
          />
          {pinSaved ? (
            <Text accessibilityLiveRegion="polite" className="font-body-semi" style={{ fontSize: 16, color: colors.primary }}>
              {t('settings.pinSaved')}
            </Text>
          ) : null}
        </Card>
      </ScrollView>
      {choosePinGate}
    </SafeScreen>
  );
}
