import { router } from 'expo-router';
import { CheckCircle, PencilSimple, Plus } from 'phosphor-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Avatar } from '@/components/kids/Avatar';
import { Card } from '@/components/ui/Card';
import { useActiveChild } from '@/hooks/useActiveChild';
import { t } from '@/lib/i18n';
import { tokens } from '@/lib/tokens';

/** Form sheet opened by the ProfilePill: switch child, edit one, or add one (gated in child-form). */
export default function ChildPickerScreen() {
  const { child: active, children, setActiveChild } = useActiveChild();

  const openForm = (id?: string) => {
    router.back();
    router.push(id ? { pathname: '/child-form', params: { id } } : '/child-form');
  };

  return (
    <ScrollView style={{ backgroundColor: tokens.surfacePage }} contentContainerStyle={{ padding: 20, rowGap: 12 }}>
      <Text className="font-display" style={{ fontSize: 24, color: tokens.textPrimary, marginBottom: 4 }}>
        {t('picker.title')}
      </Text>
      {children.map((c) => (
        <Card
          key={c.id}
          padding={12}
          onPress={() => {
            setActiveChild(c.id);
            router.back();
          }}
          accessibilityLabel={t('picker.switchTo', { name: c.name })}
          style={{ flexDirection: 'row', alignItems: 'center', columnGap: 12 }}
        >
          <Avatar avatarId={c.avatarIcon} color={c.avatarColor} size={48} />
          <Text className="font-display-semi" style={{ flex: 1, fontSize: 18, color: tokens.textPrimary }}>
            {c.name}
          </Text>
          {c.id === active?.id ? <CheckCircle size={26} color={tokens.brandPrimary} weight="fill" /> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('picker.edit', { name: c.name })}
            onPress={() => openForm(c.id)}
            hitSlop={8}
            style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <PencilSimple size={22} color={tokens.textSecondary} weight="bold" />
          </Pressable>
        </Card>
      ))}
      <Card padding={14} onPress={() => openForm()} accessibilityLabel={t('picker.add')} style={{ flexDirection: 'row', alignItems: 'center', columnGap: 12 }}>
        <View style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
          <Plus size={26} color={tokens.brandPrimary} weight="bold" />
        </View>
        <Text className="font-display-semi" style={{ fontSize: 18, color: tokens.textLink }}>
          {t('picker.add')}
        </Text>
      </Card>
    </ScrollView>
  );
}
