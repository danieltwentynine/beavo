import { Redirect } from 'expo-router';

import { ownerIdOf, useAuthStore } from '@/stores/authStore';

export default function Index() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const ownerId = useAuthStore(ownerIdOf);

  if (isLoading) {
    return null;
  }

  return <Redirect href={ownerId ? '/(tabs)/home' : '/onboarding/welcome'} />;
}
