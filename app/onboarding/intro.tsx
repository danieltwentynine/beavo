import { router } from 'expo-router';
import { Camera, Check, Clock, House, LockSimple, type IconProps, Star, Tooth } from 'phosphor-react-native';
import { type ComponentType, type ReactNode, useRef, useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BeavoWave } from '@/components/brand/BeavoBrand';
import { MouthMap } from '@/components/brushing/MouthMap';
import { Button } from '@/components/ui/Button';
import { t, type StringKey } from '@/lib/i18n';
import { cardShadow, font, radius, tokens } from '@/lib/tokens';
import { useSettingsStore } from '@/stores/settingsStore';

const WEEKDAYS = t('intro.weekdays').split(',');
const DAYS_BRUSHED = 5;

function RewardsArt() {
  const stickers: [ComponentType<IconProps>, string, string][] = [
    [Star, tokens.reward, tokens.onReward],
    [Tooth, tokens.secondary, tokens.onSecondary],
    [House, tokens.brandPrimary, tokens.textOnBrand],
  ];
  return (
    <View style={{ alignItems: 'center', rowGap: 14 }}>
      <View style={[{ flexDirection: 'row', columnGap: 6, backgroundColor: tokens.surfaceCard, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.lg }, cardShadow]}>
        {WEEKDAYS.map((day, i) => (
          <View key={i} style={{ alignItems: 'center', rowGap: 6, width: 28 }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: i < DAYS_BRUSHED ? tokens.brandPrimary : tokens.zoneEmpty }}>
              {i < DAYS_BRUSHED ? <Check size={14} color={tokens.textOnBrand} weight="bold" /> : null}
            </View>
            <Text className="font-body-semi" style={{ fontSize: 14, color: tokens.textSecondary }}>
              {day}
            </Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 10, backgroundColor: tokens.reward, paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.pill }}>
        <Star size={22} color={tokens.onReward} weight="bold" />
        <Text className="font-numeric" style={{ fontSize: 20, color: tokens.onReward }}>
          {t('intro.streak', { days: DAYS_BRUSHED })}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', columnGap: 14 }}>
        {stickers.map(([Icon, bg, fg], i) => (
          <View key={i} style={[{ width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: bg, borderWidth: 4, borderColor: tokens.surfaceCard }, cardShadow]}>
            <Icon size={28} color={fg} weight="bold" />
          </View>
        ))}
      </View>
    </View>
  );
}

function ParentsArt() {
  const rows: [ComponentType<IconProps>, StringKey][] = [
    [LockSimple, 'intro.trustGate'],
    [Star, 'intro.trustAds'],
    [Camera, 'intro.trustCamera'],
  ];
  return (
    <View style={{ alignItems: 'center', rowGap: 12 }}>
      <View style={[{ width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.brandPrimary }, cardShadow]}>
        <LockSimple size={32} color={tokens.textOnBrand} weight="bold" />
      </View>
      <View style={[{ width: 264, backgroundColor: tokens.surfaceCard, borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 6 }, cardShadow]}>
        {rows.map(([Icon, key], i) => (
          <View key={key} style={{ flexDirection: 'row', alignItems: 'center', columnGap: 10, minHeight: 48, borderTopWidth: i ? 1 : 0, borderTopColor: tokens.line }}>
            <Icon size={22} color={tokens.brandPrimary} weight="bold" />
            <Text className="font-body" style={{ flex: 1, fontSize: 16, lineHeight: 22, color: tokens.textPrimary }}>
              {t(key)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SessionArt() {
  return (
    <View style={{ alignItems: 'center', rowGap: 4 }}>
      <View style={[{ flexDirection: 'row', alignItems: 'center', columnGap: 6, height: 40, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: tokens.surfaceCard }, cardShadow]}>
        <Clock size={22} color={tokens.textPrimary} weight="bold" />
        <Text className="font-numeric" style={{ fontSize: 20, color: tokens.textPrimary }}>
          2:00
        </Text>
      </View>
      <MouthMap
        size={210}
        states={{ 'top-back-left': 'done', 'top-left': 'done', 'top-front': 'done', 'top-right': 'active' }}
      />
    </View>
  );
}

const PAGES: { art: ReactNode; artLabel: StringKey; title: StringKey; body: StringKey; next: StringKey }[] = [
  { art: <BeavoWave width={210} accessible={false} />, artLabel: 'intro.helloArt', title: 'intro.helloTitle', body: 'intro.helloBody', next: 'intro.helloNext' },
  { art: <SessionArt />, artLabel: 'intro.sessionArt', title: 'intro.sessionTitle', body: 'intro.sessionBody', next: 'intro.sessionNext' },
  { art: <RewardsArt />, artLabel: 'intro.rewardsArt', title: 'intro.rewardsTitle', body: 'intro.rewardsBody', next: 'intro.rewardsNext' },
  { art: <ParentsArt />, artLabel: 'intro.parentsArt', title: 'intro.parentsTitle', body: 'intro.parentsBody', next: 'intro.createAccount' },
];
const LAST = PAGES.length - 1;

/** The four intro screens, shown once on first launch, before the parent signs in. */
export default function IntroScreen() {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const pager = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const markIntroSeen = useSettingsStore((state) => state.markIntroSeen);

  const goTo = (index: number) => pager.current?.scrollTo({ x: index * width, animated: !reduceMotion });
  // Both exits land on the welcome screen, which holds every way to sign up (email and Google).
  const finish = (thenLogin: boolean) => {
    markIntroSeen();
    router.replace('/onboarding/welcome');
    if (thenLogin) router.push('/(auth)/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surfacePage }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ height: 52, alignItems: 'flex-end', paddingHorizontal: 12 }}>
          {page < LAST ? (
            <Button label={t('intro.skip')} variant="ghost" size="sm" fullWidth={false} onPress={() => goTo(LAST)} />
          ) : null}
        </View>
        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          onScroll={reduceMotion ? (e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width)) : undefined}
          scrollEventThrottle={64}
          style={{ flex: 1 }}
        >
          {PAGES.map((p) => (
            <View key={p.title} style={{ width }}>
              <View
                accessible
                accessibilityRole="image"
                accessibilityLabel={t(p.artLabel)}
                style={{ height: 300, marginHorizontal: 20, borderRadius: radius.xl, backgroundColor: tokens.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
              >
                {p.art}
              </View>
              <View style={{ paddingHorizontal: 28, paddingTop: 24, rowGap: 12 }}>
                <Text accessibilityRole="header" style={{ fontFamily: font.numeric, fontSize: 30, lineHeight: 34, color: tokens.textPrimary, textAlign: 'center' }}>
                  {t(p.title)}
                </Text>
                <Text className="font-body" style={{ fontSize: 17, lineHeight: 24, color: tokens.textSecondary, textAlign: 'center' }}>
                  {t(p.body)}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={{ paddingHorizontal: 20, paddingBottom: 12, alignItems: 'center', rowGap: 14 }}>
          <View accessible accessibilityRole="image" accessibilityLabel={t('intro.pageA11y', { page: page + 1, total: PAGES.length })} style={{ flexDirection: 'row', columnGap: 8, marginBottom: 6 }}>
            {PAGES.map((p, i) => (
              // The current page is a wider pill: shape, not only colour.
              <View key={p.title} style={{ width: i === page ? 28 : 10, height: 10, borderRadius: 5, backgroundColor: i === page ? tokens.brandPrimary : tokens.zoneLine, opacity: i === page ? 1 : 0.45 }} />
            ))}
          </View>
          <Button label={t(PAGES[page].next)} onPress={() => (page < LAST ? goTo(page + 1) : finish(false))} />
          {page === LAST ? <Button label={t('intro.signIn')} variant="ghost" size="sm" onPress={() => finish(true)} /> : null}
        </View>
      </SafeAreaView>
    </View>
  );
}
