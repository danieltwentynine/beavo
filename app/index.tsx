import { Redirect } from 'expo-router';

import { useAuthStore } from '@/stores/authStore';

export default function Index() {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return null;
  }

  return <Redirect href={user ? '/(tabs)/overview' : '/onboarding/welcome'} />;
}
