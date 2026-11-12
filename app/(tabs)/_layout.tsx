import { Tabs, router } from 'expo-router';
import { ChartLineUp, House, Tooth } from 'phosphor-react-native';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/lib/i18n';
import { hardShadow, tokens } from '@/lib/tokens';

function TabItem({
  label,
  active,
  icon,
  onPress,
}: {
  label: string;
  active: boolean;
  icon: (color: string, weight: 'bold' | 'fill') => React.ReactNode;
  onPress: () => void;
}) {
  const color = active ? tokens.textLink : tokens.textTertiary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={{ flex: 1, minHeight: 48, alignItems: 'center', rowGap: 4 }}
    >
      {icon(color, active ? 'fill' : 'bold')}
      <Text className="font-display-semi" style={{ fontSize: 13, color }}>
        {label}
      </Text>
    </Pressable>
  );
}

interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
}

function ZingTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const activeRoute = state.routes[state.index]?.name;

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'flex-start',
          paddingTop: 12,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
          height: 76 + (insets.bottom > 0 ? insets.bottom : 12),
          backgroundColor: tokens.surfaceCard,
          borderTopWidth: 3,
          borderTopColor: tokens.borderStrong,
        },
      ]}
    >
      <TabItem
        label={t('tabs.home')}
        active={activeRoute === 'home'}
        icon={(c, w) => <House size={25} color={c} weight={w} />}
        onPress={() => navigation.navigate('home')}
      />

      <View style={{ flex: 1, alignItems: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.startBrushing')}
          onPress={() => router.push('/session')}
          style={[
            {
              position: 'absolute',
              top: -26,
              width: 66,
              height: 66,
              borderRadius: 33,
              backgroundColor: tokens.brandPrimary,
              alignItems: 'center',
              justifyContent: 'center',
            },
            hardShadow(5),
          ]}
        >
          <Tooth size={30} color="#fff" weight="fill" />
        </Pressable>
        <Text
          className="font-display-semi"
          style={{ position: 'absolute', top: 46, fontSize: 13, color: tokens.textLink }}
        >
          {t('tabs.brush')}
        </Text>
      </View>

      <TabItem
        label={t('tabs.progress')}
        active={activeRoute === 'progress'}
        icon={(c, w) => <ChartLineUp size={25} color={c} weight={w} />}
        onPress={() => navigation.navigate('progress')}
      />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <ZingTabBar {...props} />}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="progress" />
    </Tabs>
  );
}
