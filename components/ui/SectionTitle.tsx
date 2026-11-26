import { Text } from 'react-native';

import { colors } from '@/lib/tokens';

export function SectionTitle({ children }: { children: string }) {
  return (
    <Text className="font-display" style={{ fontSize: 22, color: colors.ink, marginBottom: 12 }}>
      {children}
    </Text>
  );
}
