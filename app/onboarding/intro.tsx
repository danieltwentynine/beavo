import { router } from 'expo-router';
import { Camera, Check, Clock, House, LockSimple, type IconProps, Star, Tooth } from 'phosphor-react-native';
import { type ComponentType, type ReactNode, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Path, Svg } from 'react-native-svg';

import { BeavoWave } from '@/components/brand/BeavoBrand';
import { MouthMap } from '@/components/brushing/MouthMap';
import { Button } from '@/components/ui/Button';
import { useLiveReduceMotion } from '@/hooks/useLiveReduceMotion';
import { t, type StringKey } from '@/lib/i18n';
import { colors, fonts, radius, shadow } from '@/lib/tokens';
import { useSettingsStore } from '@/stores/settingsStore';

const WEEKDAYS = t('intro.weekdays').split(',');
const DAYS_BRUSHED = 5;

function HelloArt() {
  return (
    <View style={{ width: '100%', alignItems: 'center' }}>
      <BeavoWave width={200} accessible={false} />
      <Svg width="100%" height={44} viewBox="0 0 300 44" preserveAspectRatio="xMidYMid slice">
        <Path d="M20 12 Q56 -4 91 12 T162 12 T233 12 T304 12 M50 36 Q81 21 111 36 T172 36 T233 36"
          fill="none" stroke={colors.surface} strokeOpacity={0.75} strokeWidth={4} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function RewardsArt() {
  const stickers: [ComponentType<IconProps>, string, string][] = [
    [Star, colors.reward, colors.onReward],
    [Tooth, colors.secondary, colors.onSecondary],
    [House, colors.primary, colors.onPrimary],
  ];
  return (
    <View style={{ alignItems: 'center', rowGap: 14 }}>
      <View style={[{ flexDirection: 'row', columnGap: 6, backgroundColor: colors.surface, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.lg }, shadow.card]}>
        {WEEKDAYS.map((day, i) => (
          <View key={i} style={{ alignItems: 'center', rowGap: 6, width: 28 }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: i < DAYS_BRUSHED ? colors.primary : colors.zoneEmpty }}>
              {i < DAYS_BRUSHED ? <Check size={14} color={colors.onPrimary} weight="bold" /> : null}
            </View>
            <Text className="font-body-semi" style={{ fontSize: 16, color: colors.inkMuted }}>
              {day}
            </Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 10, backgroundColor: colors.reward, paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.pill }}>
        <Star size={22} color={colors.onReward} weight="bold" />
        <Text className="font-numeric" style={{ fontSize: 20, color: colors.onReward }}>
          {t('intro.streak', { days: DAYS_BRUSHED })}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', columnGap: 14 }}>
        {stickers.map(([Icon, bg, fg], i) => (
          <View key={i} style={[{ width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: bg, borderWidth: 4, borderColor: colors.surface }, shadow.card]}>
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
    <View style={{ width: '100%', alignItems: 'center', rowGap: 12, paddingHorizontal: 16 }}>
      <View style={[{ width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }, shadow.card]}>
        <LockSimple size={32} color={colors.onPrimary} weight="bold" />
      </View>
      <View style={[{ width: '100%', maxWidth: 264, backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 6 }, shadow.card]}>
        {rows.map(([Icon, key], i) => (
          <View key={key} style={{ flexDirection: 'row', alignItems: 'center', columnGap: 10, minHeight: 48, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
            <Icon size={22} color={colors.primary} weight="bold" />
            <Text className="font-body" style={{ flex: 1, fontSize: 16, lineHeight: 22, color: colors.ink }}>
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
      <View style={[{ flexDirection: 'row', alignItems: 'center', columnGap: 6, height: 40, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.surface }, shadow.card]}>
        <Clock size={22} color={colors.ink} weight="bold" />
        <Text className="font-numeric" style={{ fontSize: 20, color: colors.ink }}>
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
  { art: <HelloArt />, artLabel: 'intro.helloArt', title: 'intro.helloTitle', body: 'intro.helloBody', next: 'intro.helloNext' },
  { art: <SessionArt />, artLabel: 'intro.sessionArt', title: 'intro.sessionTitle', body: 'intro.sessionBody', next: 'intro.sessionNext' },
  { art: <RewardsArt />, artLabel: 'intro.rewardsArt', title: 'intro.rewardsTitle', body: 'intro.rewardsBody', next: 'intro.rewardsNext' },
  { art: <ParentsArt />, artLabel: 'intro.parentsArt', title: 'intro.parentsTitle', body: 'intro.parentsBody', next: 'intro.createAccount' },
];
const LAST = PAGES.length - 1;

/** The four intro screens, shown once on first launch, before the parent signs in. */
export default function IntroScreen() {
  const { width } = useWindowDimensions();
  const reduceMotion = useLiveReduceMotion();
  const pager = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const activeIndex = useRef(0);
  const markIntroSeen = useSettingsStore((state) => state.markIntroSeen);

  useEffect(() => {
    const frame = requestAnimationFrame(() => pager.current?.scrollTo({ x: activeIndex.current * width, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [width]);

  const selectPage = (index: number) => {
    activeIndex.current = Math.max(0, Math.min(LAST, index));
    setPage(activeIndex.current);
  };

  const goTo = (index: number) => {
    selectPage(index);
    pager.current?.scrollTo({ x: index * width, animated: !reduceMotion });
  };
  // Both exits land on the welcome screen, which holds every way to sign up (email and Google).
  const finish = (thenLogin: boolean) => {
    markIntroSeen();
    router.replace('/onboarding/welcome');
    if (thenLogin) router.push('/(auth)/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ minHeight: 52, alignItems: 'flex-end', paddingHorizontal: 12 }}>
          {page < LAST ? (
            <Button label={t('intro.skip')} variant="ghost" size="sm" fullWidth={false} onPress={() => goTo(LAST)} />
          ) : null}
        </View>
        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => selectPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          style={{ flex: 1 }}
        >
          {PAGES.map((p, index) => (
            <ScrollView key={p.title} nestedScrollEnabled
              accessibilityElementsHidden={page !== index}
              importantForAccessibility={page === index ? 'auto' : 'no-hide-descendants'}
              style={{ width }} contentContainerStyle={{ paddingBottom: 16 }}>
              <View
                accessible
                accessibilityRole="image"
                accessibilityLabel={t(p.artLabel)}
                style={{ minHeight: 300, maxWidth: 400, width: '90%', alignSelf: 'center', paddingVertical: 20, borderRadius: radius.xl, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
              >
                {p.art}
              </View>
              <View style={{ paddingHorizontal: 28, paddingTop: 24, rowGap: 12, maxWidth: 500, alignSelf: 'center', width: '100%' }}>
                <Text accessibilityRole="header" style={{ fontFamily: fonts.displayExtraBold, fontSize: 30, lineHeight: 34, color: colors.ink, textAlign: 'center' }}>
                  {t(p.title)}
                </Text>
                <Text className="font-body" style={{ fontSize: 17, lineHeight: 24, color: colors.inkMuted, textAlign: 'center' }}>
                  {t(p.body)}
                </Text>
              </View>
            </ScrollView>
          ))}
        </ScrollView>
        <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 12, alignItems: 'center', rowGap: 10 }}>
          <View accessible accessibilityRole="image" accessibilityLabel={t('intro.pageA11y', { page: page + 1, total: PAGES.length })} style={{ flexDirection: 'row', columnGap: 8, marginBottom: 6 }}>
            {PAGES.map((p, i) => (
              // The current page is a wider pill: shape, not only colour.
              <View key={p.title} style={{ width: i === page ? 28 : 10, height: 10, borderRadius: 5, backgroundColor: i === page ? colors.primary : colors.zoneLine, opacity: i === page ? 1 : 0.45 }} />
            ))}
          </View>
          <Button label={t(PAGES[page].next)} style={{ paddingVertical: 10 }} onPress={() => (page < LAST ? goTo(page + 1) : finish(false))} />
          {page === LAST ? <Button label={t('intro.signIn')} variant="ghost" size="sm" onPress={() => finish(true)} /> : null}
        </View>
      </SafeAreaView>
    </View>
  );
}
