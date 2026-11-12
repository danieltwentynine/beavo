import {
  Butterfly,
  Cat,
  Dog,
  Fish,
  Heart,
  type IconProps,
  Robot,
  Rocket,
  Star,
} from 'phosphor-react-native';
import { useState, type ComponentType } from 'react';
import { Pressable, View } from 'react-native';

import { t, type StringKey } from '@/lib/i18n';
import { motion, radius, tokens } from '@/lib/tokens';

type AvatarConfig = { Icon: ComponentType<IconProps>; bg: string };

// Phosphor has no Shark in RN; Fish is the closest friendly substitute.
// Every bg clears 3:1 against white so the white fill icon stays legible, and
// no two are within 30 CIELAB dE of each other — a child picks by color name.
// These are avatar-only shades, not design tokens: they are also stored on
// children.avatarColor, so changing one changes nothing for existing children.
const AVATARS: Record<string, AvatarConfig> = {
  shark: { Icon: Fish, bg: '#1690d2' },
  robot: { Icon: Robot, bg: '#14142b' },
  rocket: { Icon: Rocket, bg: '#55557a' },
  cat: { Icon: Cat, bg: '#c0560c' },
  dog: { Icon: Dog, bg: '#00876f' },
  butterfly: { Icon: Butterfly, bg: '#6d4fd6' },
  star: { Icon: Star, bg: '#a8850f' },
  heart: { Icon: Heart, bg: '#d6247a' },
};

export const AVATAR_IDS = Object.keys(AVATARS);

/** Avatar background choices (children.avatarColor); all clear 3:1 against the white icon. */
export const AVATAR_COLORS = [...new Set(Object.values(AVATARS).map((a) => a.bg))];

/** The color an icon comes with, used until the parent picks another. */
export const defaultAvatarColor = (avatarId: string): string => (AVATARS[avatarId] ?? AVATARS.dog).bg;

interface AvatarProps {
  avatarId?: string;
  /** Background override (children.avatarColor); defaults to the icon's own color. */
  color?: string;
  size?: number;
  ring?: boolean;
}

export function Avatar({ avatarId = 'dog', color, size = 56, ring = false }: AvatarProps) {
  const a = AVATARS[avatarId] ?? AVATARS.dog;
  const circle = (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius.pill,
          backgroundColor: color ?? a.bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      <a.Icon size={size * 0.52} color="#fff" weight="fill" />
    </View>
  );

  if (!ring) return circle;
  // selected: primary ring with a white gap around the circle
  return (
    <View
      style={{
        padding: 2,
        borderRadius: radius.pill,
        borderWidth: 3,
        borderColor: tokens.brandPrimary,
        backgroundColor: tokens.surfaceCard,
      }}
    >
      {circle}
    </View>
  );
}

interface AvatarPickerProps {
  value?: string;
  /** Show every character in this color (the child's chosen avatarColor). */
  color?: string;
  onChange?: (id: string) => void;
}

/** AvatarPicker — the child chooses their character during onboarding. */
export function AvatarPicker({ value = 'dog', color, onChange }: AvatarPickerProps) {
  // Pressed state lives in React state because NativeWind's runtime drops
  // Pressable's function-form style prop (nativewind/nativewind#1105).
  const [pressedId, setPressedId] = useState<string | null>(null);

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 }}>
      {AVATAR_IDS.map((id) => {
        const selected = id === value;
        return (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityLabel={t(`avatar.${id}` as StringKey)}
            accessibilityState={{ selected }}
            onPress={() => onChange?.(id)}
            onPressIn={() => setPressedId(id)}
            onPressOut={() => setPressedId(null)}
            // Fixed 4-column cells, tall enough for the selected ring (56 + 12),
            // so choosing a character never reflows the grid.
            style={{ width: '25%', height: 84, alignItems: 'center', justifyContent: 'center' }}
          >
            <View
              style={{
                flex: 1,
                alignSelf: 'stretch',
                marginHorizontal: 4,
                borderRadius: radius.lg,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? tokens.primarySoft : 'transparent',
                transform: [{ scale: pressedId === id ? motion.pressScale : 1 }],
              }}
            >
              <Avatar avatarId={id} color={color} size={56} ring={selected} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
