import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TabHeader } from '@/components/ui/TabHeader';
import { t } from '@/lib/i18n';
import { tokens } from '@/lib/tokens';

/** Placeholder until the brushing redesign (step 2). */
export default function BrushingTab() {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.surfacePage }}>
      <View style={{ padding: 20, paddingTop: 4, rowGap: 18 }}>
        <TabHeader title={t('brushing.title')} />
        <Card padding={18}>
          <Text className="font-body" style={{ fontSize: 16, color: tokens.textSecondary }}>
            {t('brushing.soon')}
          </Text>
        </Card>
        <Button label={t('overview.start')} size="lg" onPress={() => router.push('/session')} />
        <Button label={t('brushing.editTimes')} variant="outline" onPress={() => router.push('/slots')} />
      </View>
    </SafeAreaView>
  );
}
