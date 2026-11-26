import { Text, View } from 'react-native';

import { colors, radius } from '@/lib/tokens';

interface StickerProps {
  label: string;
}

/** Sticker — a hand-placed reward label; the only thing that tilts. Berry takes white text. */
export function Sticker({ label }: StickerProps) {
  return (
    <View
      style={{
          alignSelf: 'center',
          backgroundColor: colors.reward,
          borderRadius: radius.pill,
          paddingHorizontal: 14,
          paddingVertical: 6,
          transform: [{ rotate: '-4deg' }],
        }}
    >
      <Text className="font-display-semi" style={{ fontSize: 16, color: colors.onReward }}>
        {label}
      </Text>
    </View>
  );
}
