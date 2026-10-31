import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { TabHeader } from '@/components/ui/TabHeader';
import { useActiveChild } from '@/hooks/useActiveChild';
import { t } from '@/lib/i18n';
import { tokens } from '@/lib/tokens';

/** Placeholder until progress is rebuilt on brushingSessions (step 2). */
export default function ProgressTab() {
  const { child } = useActiveChild();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.surfacePage }}>
      <View style={{ padding: 20, paddingTop: 4, rowGap: 18 }}>
        <TabHeader title={t('progress.title')} />
        <Card padding={18}>
          <Text className="font-body" style={{ fontSize: 16, color: tokens.textSecondary }}>
            {t('progress.soon', { name: child?.name ?? '' })}
          </Text>
        </Card>
      </View>
    </SafeAreaView>
  );
}
