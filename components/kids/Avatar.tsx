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

import { t } from '@/lib/i18n';
import { motion, outline, palette, radius, tokens } from '@/lib/tokens';

type AvatarConfig = { Icon: ComponentType<IconProps>; bg: string };

// Phosphor has no Shark in RN; Fish is the closest friendly substitute.
// Every bg clears 3:1 against white so the white fill icon stays legible, and
// no two are within 30 CIELAB dE of each other — a child picks by color name.
// The Toy box ramps' 500s are too light for a white icon, hence the deep
// avatar-only shades below.
const AVATARS = {
  shark: { Icon: Fish, bg: palette.sky[600] },
  robot: { Icon: Robot, bg: palette.ink[900] },
  rocket: { Icon: Rocket, bg: palette.ink[500] },
  cat: { Icon: Cat, bg: '#c0560c' },
  dog: { Icon: Dog, bg: '#00876f' },
  butterfly: { Icon: Butterfly, bg: '#6d4fd6' },
  star: { Icon: Star, bg: '#a8850f' },
  heart: { Icon: Heart, bg: palette.bubblegum[600] },
} satisfies Record<string, AvatarConfig>;

type AvatarId = keyof typeof AVATARS;

export const AVATAR_IDS = Object.keys(AVATARS) as AvatarId[];

interface AvatarProps {
  avatarId?: string;
  size?: number;
  ring?: boolean;
}

export function Avatar({ avatarId = 'dog', size = 56, ring = false }: AvatarProps) {
  const a: AvatarConfig = avatarId in AVATARS ? AVATARS[avatarId as AvatarId] : AVATARS.dog;
  const circle = (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius.pill,
          backgroundColor: a.bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        outline,
      ]}
    >
      <a.Icon size={size * 0.52} color="#fff" weight="fill" />
    </View>
  );

  if (!ring) return circle;
  // selected: cobalt ring with a white gap around the outlined circle
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
  onChange?: (id: string) => void;
}

/** AvatarPicker — the child chooses their character during onboarding. */
export function AvatarPicker({ value = 'dog', onChange }: AvatarPickerProps) {
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
            accessibilityLabel={t(`avatar.${id}`)}
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
                borderRadius: radius.xl,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? tokens.surfaceMint : 'transparent',
                transform: [{ scale: pressedId === id ? motion.pressScale : 1 }],
              }}
            >
              <Avatar avatarId={id} size={56} ring={selected} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
