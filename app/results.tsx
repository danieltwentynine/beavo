import { Redirect, router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoachCard } from '@/components/brushing/CoachCard';
import { DayStamp } from '@/components/brushing/DayStamp';
import { MouthMap } from '@/components/brushing/MouthMap';
import { Button } from '@/components/ui/Button';
import { colors, controlBorder } from '@/lib/tokens';
import { t } from '@/lib/i18n';
import { useSessionStore } from '@/stores/sessionStore';

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 5 }}>
      <View style={{ width: 16, height: 16, borderRadius: 5, backgroundColor: color, ...controlBorder }} />
      <Text className="font-body-semi" style={{ fontSize: 16, color: colors.inkMuted }}>
        {label}
      </Text>
    </View>
  );
}

export default function ResultsScreen() {
  const result = useSessionStore((s) => s.lastResult);
  const saveStatus = useSessionStore((s) => s.saveStatus);
  const retrySave = useSessionStore((s) => s.saveLastResult);

  if (!result) {
    return <Redirect href="/(tabs)/brushing" />;
  }

  const title = result.score >= 80 ? t('results.great') : t('results.good');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 28, paddingTop: 8, alignItems: 'center' }}>
        <Text
          className="font-display-semi"
          style={{ fontSize: 16, letterSpacing: 1.1, color: colors.primary, marginTop: 6 }}
        >
          {t('results.complete')}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginVertical: 4 }}>
          <Text className="font-numeric" style={{ fontSize: 88, color: colors.ink, lineHeight: 116 }}>
            {result.score}
          </Text>
          <Text className="font-numeric" style={{ fontSize: 34, color: colors.inkMuted, marginBottom: 10 }}>
            /100
          </Text>
        </View>

        <Text className="font-display" style={{ fontSize: 26, color: colors.ink }}>
          {title}
        </Text>

        <DayStamp />

        <View style={{ marginTop: 14, marginBottom: 6 }}>
          <MouthMap states={result.zoneStates} size={200} />
        </View>

        <View style={{ flexDirection: 'row', columnGap: 16, marginBottom: 18 }}>
          <LegendDot color={colors.sessionAccent} label={t('results.brushed')} />
          <LegendDot color={colors.warning} label={t('results.missed')} />
        </View>

        <CoachCard score={result.score} message={result.coachMessage} style={{ width: '100%' }} />
        {result.totalSec < 120 ? (
          <Text className="font-body" style={{ marginTop: 12, fontSize: 16, color: colors.inkMuted, textAlign: 'center' }}>
            {t('results.shortTimer')}
          </Text>
        ) : null}

        {/* Save state, in the child's language — never an error message, and it
            never blocks the buttons below. "Saving" only lasts a few seconds: the
            store flips to 'pending' rather than spinning forever while offline. */}
        {saveStatus === 'saving' ? (
          <Text
            className="font-body-semi"
            style={{ fontSize: 16, color: colors.inkMuted, marginTop: 14 }}
          >
            {t('results.saving')}
          </Text>
        ) : null}

        {saveStatus === 'pending' ? (
          <Text
            className="font-body-semi"
            style={{ fontSize: 16, color: colors.inkMuted, marginTop: 14, textAlign: 'center' }}
          >
            {t('results.pending')}
          </Text>
        ) : null}

        {saveStatus === 'failed' ? (
          <View style={{ alignItems: 'center', rowGap: 10, marginTop: 14 }}>
            <Text
              className="font-body-semi"
              style={{ fontSize: 16, color: colors.ink, textAlign: 'center' }}
            >
              {t('results.failed')}
            </Text>
            <Button
              label={t('results.retry')}
              variant="ghost"
              size="sm"
              fullWidth={false}
              onPress={() => void retrySave()}
            />
          </View>
        ) : null}

        <View style={{ width: '100%', rowGap: 12, marginTop: 'auto', paddingTop: 22 }}>
          <Button label={t('results.seeProgress')} size="lg" onPress={() => router.replace('/(tabs)/progress')} />
          <Button label={t('results.again')} variant="soft" onPress={() => router.replace({ pathname: '/session', params: result.slotId ? { slotId: result.slotId } : {} })} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
