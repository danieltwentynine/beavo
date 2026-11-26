import { router } from 'expo-router';
import { CaretDown } from 'phosphor-react-native';
import { Pressable, Text } from 'react-native';

import { Avatar } from '@/components/kids/Avatar';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { useActiveChild } from '@/hooks/useActiveChild';
import { t } from '@/lib/i18n';
import { colors, radius, shadow } from '@/lib/tokens';

/** Top-right switcher (floating chrome → Liquid Glass): shows who is brushing, opens the picker sheet. */
export function ProfilePill() {
  const { child } = useActiveChild();
  if (!child) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('picker.title')} ${child.name}`}
      onPress={() => router.push('/child-picker')}
      style={[{ borderRadius: radius.pill, maxWidth: '46%' }, shadow.card]}
    >
      <GlassSurface
        interactive
        style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8, minHeight: 52, paddingLeft: 4, paddingRight: 12, borderRadius: radius.pill }}
      >
        <Avatar avatarId={child.avatarIcon} color={child.avatarColor} size={36} />
        <Text className="font-display-semi" numberOfLines={1} style={{ fontSize: 16, flexShrink: 1, maxWidth: 110, color: colors.ink }}>
          {child.name}
        </Text>
        <CaretDown size={16} color={colors.ink} weight="bold" />
      </GlassSurface>
    </Pressable>
  );
}
