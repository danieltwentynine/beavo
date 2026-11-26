import { CloudSun, Moon, Sparkle, Star, Sun, SunHorizon, Tooth, type IconProps } from 'phosphor-react-native';
import type { ComponentType } from 'react';

/** brushingSlots.icon ids → icons. Unknown ids fall back to the tooth. */
const SLOT_ICONS: Record<string, ComponentType<IconProps>> = {
  sun: Sun,
  'sun-horizon': SunHorizon,
  'cloud-sun': CloudSun,
  moon: Moon,
  star: Star,
  sparkle: Sparkle,
  tooth: Tooth,
};

export const SLOT_ICON_IDS = Object.keys(SLOT_ICONS);

export function SlotIcon({ icon, ...props }: { icon: string } & IconProps) {
  const Icon = SLOT_ICONS[icon] ?? Tooth;
  return <Icon {...props} />;
}
