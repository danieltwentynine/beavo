import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { BeavoMark } from '@/components/brand/BeavoBrand';
import { Button } from '@/components/ui/Button';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { t } from '@/lib/i18n';
import { tokens } from '@/lib/tokens';

/** Placeholder until subscriptions (Phase 3, RevenueCat). Reached only through the parental gate. */
export default function PremiumScreen() {
  return (
    <SafeScreen>
      <View style={{ flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', rowGap: 16 }}>
        <BeavoMark width={140} />
        <Text className="font-display" style={{ fontSize: 28, color: tokens.textPrimary, textAlign: 'center' }}>
          {t('premium.title')}
        </Text>
        <Text className="font-body" style={{ fontSize: 16, color: tokens.textSecondary, textAlign: 'center' }}>
          {t('premium.body')}
        </Text>
        <Button label={t('event.back')} variant="outline" onPress={() => router.back()} />
      </View>
    </SafeScreen>
  );
}
