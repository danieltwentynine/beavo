import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SafeScreenProps {
  children: ReactNode;
}

export function SafeScreen({ children }: SafeScreenProps) {
  return <SafeAreaView className="flex-1 bg-bg">{children}</SafeAreaView>;
}
