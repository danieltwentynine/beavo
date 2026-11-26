import { ArrowSquareOut, CaretRight, type IconProps } from 'phosphor-react-native';
import type { ComponentType, ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { colors, radius } from '@/lib/tokens';

const ROW_TILES = {
  primary: [colors.primarySoft, colors.primary],
  routine: [colors.tileRoutine, colors.tileRoutineInk],
  profiles: [colors.tileProfiles, colors.reward],
  categories: [colors.tileCategories, colors.tileCategoriesInk],
  export: [colors.tileExport, colors.tileExportInk],
  import: [colors.tileImport, colors.tileImportInk],
  neutral: [colors.tileSettings, colors.tileSettingsInk],
  danger: [colors.dangerSoft, colors.danger],
} as const;

interface ListRowProps {
  Icon: ComponentType<IconProps>;
  label: string;
  hint?: string;
  onPress?: () => void;
  /** Leaves the app (shows an external-link mark). */
  external?: boolean;
  /** Replaces the chevron, e.g. a Switch. */
  right?: ReactNode;
  last?: boolean;
  tile?: keyof typeof ROW_TILES;
}

/** One row of a grouped list (inside a Card with padding 0). */
export function ListRow({ Icon, label, hint, onPress, external, right, last, tile = 'neutral' }: ListRowProps) {
  const [tileBackground, iconColor] = ROW_TILES[tile];
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 14,
        minHeight: 64,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.line,
      }}
    >
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
        style={{ width: 42, height: 42, borderRadius: radius.md, backgroundColor: tileBackground, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={22} color={iconColor} weight="bold" />
      </View>
      <View style={{ flex: 1 }}>
        <Text className="font-body-semi" style={{ fontSize: 17, color: tile === 'danger' ? colors.danger : colors.ink }}>
          {label}
        </Text>
        {hint ? (
          <Text className="font-body" style={{ fontSize: 16, color: colors.inkMuted }}>
            {hint}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? (external ? <ArrowSquareOut size={20} color={colors.inkMuted} weight="bold" /> : <CaretRight size={20} color={colors.inkMuted} weight="bold" />) : null)}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole={external ? 'link' : 'button'} accessibilityLabel={label} accessibilityHint={hint} onPress={onPress}>
      {body}
    </Pressable>
  );
}
