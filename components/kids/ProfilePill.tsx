import { router } from 'expo-router';
import { CaretDown } from 'phosphor-react-native';
import { Text } from 'react-native';

import { Avatar } from '@/components/kids/Avatar';
import { Card } from '@/components/ui/Card';
import { useActiveChild } from '@/hooks/useActiveChild';
import { t } from '@/lib/i18n';
import { radius, tokens } from '@/lib/tokens';

/** Top-right switcher: shows who is brushing, opens the child picker sheet. */
export function ProfilePill() {
  const { child } = useActiveChild();
  if (!child) return null;
  return (
    <Card
      onPress={() => router.push('/child-picker')}
      accessibilityLabel={t('picker.title')}
      padding={0}
      radius={radius.pill}
      style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8, height: 48, paddingLeft: 4, paddingRight: 12 }}
    >
      <Avatar avatarId={child.avatarIcon} color={child.avatarColor} size={36} />
      <Text className="font-display-semi" numberOfLines={1} style={{ fontSize: 16, maxWidth: 110, color: tokens.textPrimary }}>
        {child.name}
      </Text>
      <CaretDown size={16} color={tokens.textPrimary} weight="bold" />
    </Card>
  );
}
