import { Text, View } from 'react-native';

import { radius, tokens } from '@/lib/tokens';

interface StickerProps {
  label: string;
  bg?: string;
  tilt?: number;
}

/** Sticker — a hand-placed reward label; the only thing that tilts. Berry takes white text. */
export function Sticker({ label, bg = tokens.reward, tilt = -4 }: StickerProps) {
  return (
    <View
      style={{
          alignSelf: 'center',
          backgroundColor: bg,
          borderRadius: radius.pill,
          paddingHorizontal: 14,
          paddingVertical: 6,
          transform: [{ rotate: `${tilt}deg` }],
        }}
    >
      <Text className="font-display-semi" style={{ fontSize: 15, color: tokens.onReward }}>
        {label}
      </Text>
    </View>
  );
}
