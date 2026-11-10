import { Camera as CameraIcon } from 'phosphor-react-native';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { t } from '@/lib/i18n';
import { tokens } from '@/lib/tokens';

interface CameraGateProps {
  onAllow: () => void;
  onSkip: () => void;
}

/**
 * Parent-facing explainer shown BEFORE the system camera prompt (CLAUDE.md > Never:
 * no camera permission without explaining why first). The camera is only a mirror.
 */
export function CameraGate({ onAllow, onSkip }: CameraGateProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, rowGap: 14 }}>
      <CameraIcon size={56} color={tokens.brandPrimary} weight="fill" />
      <Text className="font-display" style={{ fontSize: 28, color: tokens.textPrimary, textAlign: 'center' }}>
        {t('camera.title')}
      </Text>
      <Text className="font-body" style={{ fontSize: 16, color: tokens.textSecondary, textAlign: 'center' }}>
        {t('camera.body')}
      </Text>
      <View style={{ rowGap: 10, alignSelf: 'stretch', marginTop: 10 }}>
        <Button label={t('camera.allow')} onPress={onAllow} fullWidth />
        <Button label={t('camera.skip')} onPress={onSkip} variant="outline" fullWidth />
      </View>
    </View>
  );
}
