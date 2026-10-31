import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { ProfilePill } from '@/components/kids/ProfilePill';
import { tokens } from '@/lib/tokens';

interface TabHeaderProps {
  title?: string;
  /** Replaces the title, e.g. a greeting block. */
  children?: ReactNode;
  showProfile?: boolean;
}

/** Tab screen header: title on the left, the child switcher top-right. */
export function TabHeader({ title, children, showProfile = true }: TabHeaderProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', columnGap: 12, minHeight: 52 }}>
      <View style={{ flex: 1 }}>
        {children ?? (
          <Text className="font-display" style={{ fontSize: 28, color: tokens.textPrimary }}>
            {title}
          </Text>
        )}
      </View>
      {showProfile ? <ProfilePill /> : null}
    </View>
  );
}
