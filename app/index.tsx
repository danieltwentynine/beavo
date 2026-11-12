import { Redirect } from 'expo-router';

import { ownerIdOf, useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';

export default function Index() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const ownerId = useAuthStore(ownerIdOf);
  const { introSeen, loaded } = useSettingsStore();

  if (isLoading || !loaded) {
    return null;
  }

  if (ownerId) return <Redirect href="/(tabs)/overview" />;
  return <Redirect href={introSeen ? '/onboarding/welcome' : '/onboarding/intro'} />;
}
