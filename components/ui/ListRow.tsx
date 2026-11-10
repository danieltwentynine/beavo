import { ArrowSquareOut, CaretRight, type IconProps } from 'phosphor-react-native';
import type { ComponentType, ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { tokens } from '@/lib/tokens';

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
}

/** One row of a grouped list (inside a Card with padding 0). */
export function ListRow({ Icon, label, hint, onPress, external, right, last }: ListRowProps) {
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 14,
        minHeight: 56,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: last ? 0 : 2,
        borderBottomColor: tokens.line,
      }}
    >
      <Icon size={24} color={tokens.textPrimary} weight="bold" />
      <View style={{ flex: 1 }}>
        <Text className="font-body-semi" style={{ fontSize: 16, color: tokens.textPrimary }}>
          {label}
        </Text>
        {hint ? (
          <Text className="font-body" style={{ fontSize: 13, color: tokens.textSecondary }}>
            {hint}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? (external ? <ArrowSquareOut size={20} color={tokens.textSecondary} weight="bold" /> : <CaretRight size={20} color={tokens.textSecondary} weight="bold" />) : null)}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole={external ? 'link' : 'button'} accessibilityLabel={label} accessibilityHint={hint} onPress={onPress}>
      {body}
    </Pressable>
  );
}
