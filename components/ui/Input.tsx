import { type ReactNode, useState } from 'react';
import { Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { colors, fonts, radius } from '@/lib/tokens';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: ReactNode;
  containerStyle?: ViewStyle;
}

/**
 * Input — 56px tall, 16px radius, a control border that turns primary on focus
 * (with a soft ring) and danger on error.
 */
export function Input({ label, error, icon, containerStyle, onFocus, onBlur, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.danger
    : focused
    ? colors.primary
    : colors.zoneLine;

  return (
    <View style={[{ rowGap: 6 }, containerStyle]}>
      {label ? (
        <Text className="font-body-semi" style={{ fontSize: 16, color: colors.ink }}>
          {label}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          columnGap: 10,
          minHeight: 56,
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: radius.md,
          backgroundColor: rest.editable === false ? colors.bg : colors.surface,
          borderWidth: 2,
          borderColor,
          // boxShadow must stay present at all times and only change value.
          // Adding/removing a shadow key on focus makes Fabric recreate the native
          // view, which resigns first responder and instantly blurs the field
          // (facebook/react-native#53440).
          boxShadow: `0 0 0 ${focused ? 3 : 0}px ${colors.primarySoft}`,
        }}
      >
        {icon}
        <TextInput
          placeholderTextColor={colors.inkMuted}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={{
            flex: 1,
            fontFamily: fonts.body,
            fontSize: 16,
            color: colors.ink,
            padding: 0,
          }}
          {...rest}
        />
      </View>
      {error ? (
        <Text className="font-body" style={{ fontSize: 16, color: colors.danger }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
