import { Redirect } from 'expo-router';

import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';

export default function Index() {
  const { user, isLoading } = useAuthStore();
  const { introSeen, loaded } = useSettingsStore();

  if (isLoading || !loaded) {
    return null;
  }

  if (user) return <Redirect href="/(tabs)/overview" />;
  return <Redirect href={introSeen ? '/onboarding/welcome' : '/onboarding/intro'} />;
}
