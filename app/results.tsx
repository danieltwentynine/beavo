import { Redirect, router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoachCard } from '@/components/brushing/CoachCard';
import { MouthMap } from '@/components/brushing/MouthMap';
import { Button } from '@/components/ui/Button';
import { t } from '@/lib/i18n';
import { outline, tokens } from '@/lib/tokens';
import { useSessionStore } from '@/stores/sessionStore';

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 5 }}>
      <View style={{ width: 16, height: 16, borderRadius: 5, backgroundColor: color, ...outline, borderWidth: 2 }} />
      <Text className="font-body-semi" style={{ fontSize: 14, color: tokens.textSecondary }}>
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
    return <Redirect href="/(tabs)/home" />;
  }

  const title = result.score >= 80 ? t('results.great') : t('results.good');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.surfacePage }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 28, paddingTop: 8, alignItems: 'center' }}>
        <Text
          className="font-display-semi"
          style={{ fontSize: 15, letterSpacing: 1.1, color: tokens.textLink, marginTop: 6 }}
        >
          {t('results.complete')}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginVertical: 4 }}>
          <Text className="font-numeric" style={{ fontSize: 88, color: tokens.textPrimary, lineHeight: 92 }}>
            {result.score}
          </Text>
          <Text className="font-numeric" style={{ fontSize: 34, color: tokens.textTertiary, marginBottom: 10 }}>
            /100
          </Text>
        </View>

        <Text className="font-display" style={{ fontSize: 26, color: tokens.textPrimary }}>
          {title}
        </Text>

        <View style={{ marginTop: 14, marginBottom: 6 }}>
          <MouthMap states={result.zoneStates} size={200} />
        </View>

        <View style={{ flexDirection: 'row', columnGap: 16, marginBottom: 18 }}>
          <LegendDot color={tokens.zoneDone} label={t('results.brushed')} />
          <LegendDot color={tokens.zoneMissed} label={t('results.missed')} />
        </View>

        <CoachCard score={result.score} message={result.coachMessage} style={{ width: '100%' }} />

        {/* Save state, in the child's language — never an error message, and it
            never blocks the buttons below. "Saving" only lasts a few seconds: the
            store flips to 'pending' rather than spinning forever while offline. */}
        {saveStatus === 'saving' ? (
          <Text
            className="font-body-semi"
            style={{ fontSize: 14, color: tokens.textSecondary, marginTop: 14 }}
          >
            {t('results.saving')}
          </Text>
        ) : null}

        {saveStatus === 'pending' ? (
          <Text
            className="font-body-semi"
            style={{ fontSize: 14, color: tokens.textSecondary, marginTop: 14, textAlign: 'center' }}
          >
            {t('results.pending')}
          </Text>
        ) : null}

        {saveStatus === 'failed' ? (
          <View style={{ alignItems: 'center', rowGap: 10, marginTop: 14 }}>
            <Text
              className="font-body-semi"
              style={{ fontSize: 14, color: tokens.textPrimary, textAlign: 'center' }}
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
          <Button label={t('results.again')} variant="soft" onPress={() => router.replace('/session')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
