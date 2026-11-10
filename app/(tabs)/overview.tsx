import { router } from 'expo-router';
import { CaretRight, Check, SelectionPlus } from 'phosphor-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DentalArch, DentalArchLegend } from '@/components/teeth/DentalArch';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { Card } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { TabHeader } from '@/components/ui/TabHeader';
import { useActiveChild } from '@/hooks/useActiveChild';
import { useToothEvents } from '@/hooks/useToothEvents';
import { t } from '@/lib/i18n';
import { cardShadow, radius, tokens } from '@/lib/tokens';
import { countForYear, statusByTooth } from '@/src/data/teeth';

const CARD_PADDING = 16;

/** Round button floating in a card corner. */
function CornerButton({
  label,
  active,
  disabled,
  onPress,
  children,
  style,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: ReactNode;
  style: { left?: number; right?: number };
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={[
        {
          position: 'absolute',
          top: 12,
          width: 48,
          height: 48,
          borderRadius: radius.pill,
          opacity: disabled ? 0.4 : 1,
          zIndex: 2,
        },
        cardShadow,
        style,
      ]}
    >
      {/* Floating chrome → Liquid Glass where available (GlassSurface falls back to solid). */}
      <GlassSurface
        interactive
        tint={active ? tokens.brandPrimary : undefined}
        style={{ flex: 1, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' }}
      >
        {children}
      </GlassSurface>
    </Pressable>
  );
}

function StatCard({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <Card padding={16} style={{ flex: 1, rowGap: 6 }}>
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 6,
          backgroundColor: color,
          borderWidth: 2,
          borderColor: tokens.line,
        }}
      />
      <Text className="font-numeric" style={{ fontSize: 36, color: tokens.textPrimary, lineHeight: 40 }}>
        {count}
      </Text>
      <Text className="font-body-semi" style={{ fontSize: 15, color: tokens.textSecondary }}>
        {label}
      </Text>
    </Card>
  );
}

const openToothSheet = (teeth: readonly number[]) =>
  router.push({ pathname: '/tooth-sheet', params: { teeth: teeth.join(',') } });

export default function OverviewScreen() {
  const { child } = useActiveChild();
  // Kid mode: the chart is view-only (no records, no history).
  const kidMode = child?.kidMode ?? true; // fails closed while the child loads
  const events = useToothEvents();
  const status = useMemo(() => statusByTooth(events), [events]);
  const year = new Date().getFullYear();
  const counts = useMemo(() => countForYear(events, year), [events, year]);

  const [archWidth, setArchWidth] = useState(0);
  const [multiSelect, setMultiSelect] = useState(false);
  // Selection belongs to one child: switching child shows an empty selection.
  const [picked, setPicked] = useState<{ childId: string | null; teeth: number[] }>({ childId: null, teeth: [] });
  const selected = picked.childId === (child?.id ?? null) ? picked.teeth : [];
  const setSelected = (teeth: number[]) => setPicked({ childId: child?.id ?? null, teeth });

  const onSelect = (fdi: number) => {
    if (multiSelect) {
      setSelected(selected.includes(fdi) ? selected.filter((x) => x !== fdi) : [...selected, fdi]);
      return;
    }
    setSelected([fdi]);
    if (!kidMode) openToothSheet([fdi]);
  };

  const toggleMultiSelect = () => {
    setMultiSelect((m) => !m);
    setSelected([]);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.surfacePage }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, rowGap: 22 }}>
        <TabHeader title={t('overview.title')} />

        <Card tone="soft" padding={CARD_PADDING} radius={radius.xl}>
          {kidMode ? null : (
            <>
              <CornerButton
                label={multiSelect ? t('arch.multiSelectOff') : t('arch.multiSelectOn')}
                active={multiSelect}
                onPress={toggleMultiSelect}
                style={{ left: 12 }}
              >
                <SelectionPlus size={24} color={multiSelect ? tokens.textOnBrand : tokens.textPrimary} weight="bold" />
              </CornerButton>
              <CornerButton
                label={t('arch.logSelection')}
                active={selected.length > 0}
                disabled={selected.length === 0}
                onPress={() => openToothSheet(selected)}
                style={{ right: 12 }}
              >
                <Check size={24} color={selected.length > 0 ? tokens.textOnBrand : tokens.textPrimary} weight="bold" />
              </CornerButton>
            </>
          )}

          <View
            accessibilityLabel={t('arch.chartLabel')}
            onLayout={(e) => setArchWidth(Math.round(e.nativeEvent.layout.width))}
            style={{ alignSelf: 'stretch', marginTop: 8 }}
          >
            {archWidth > 0 ? (
              <DentalArch
                size={archWidth}
                selected={selected}
                onSelect={onSelect}
                multiSelect={multiSelect && !kidMode}
                statusByTooth={status}
              />
            ) : null}
          </View>
          <View style={{ marginTop: 10 }}>
            <DentalArchLegend />
          </View>
        </Card>

        <View>
          <SectionTitle>{t('overview.thisYear')}</SectionTitle>
          <View style={{ flexDirection: 'row', columnGap: 12 }}>
            <StatCard count={counts.symptoms} label={t('overview.symptoms')} color={tokens.warning} />
            <StatCard count={counts.treatments} label={t('overview.treatments')} color={tokens.brandPrimary} />
          </View>
        </View>

        {kidMode ? null : (
          <Card
            padding={18}
            onPress={() => router.push('/dental-history')}
            accessibilityLabel={`${t('overview.history')}, ${t('overview.historyCount', { count: events.length })}`}
            style={{ flexDirection: 'row', alignItems: 'center', columnGap: 12 }}
          >
            <View style={{ flex: 1 }}>
              <Text className="font-display-semi" style={{ fontSize: 18, color: tokens.textPrimary }}>
                {t('overview.history')}
              </Text>
              <Text className="font-body" style={{ fontSize: 14, color: tokens.textSecondary }}>
                {t('overview.historyCount', { count: events.length })}
              </Text>
            </View>
            <CaretRight size={22} color={tokens.textPrimary} weight="bold" />
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
