import { Redirect } from 'expo-router';

import { ownerIdOf, useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { launchRoute } from '@/src/data/launch';

/** First launch → intro; later → welcome, or the tabs (Escovação) with an owner (src/data/launch.ts). */
export default function Index() {
  const authLoading = useAuthStore((s) => s.isLoading);
  const ownerId = useAuthStore(ownerIdOf);
  const introSeen = useSettingsStore((s) => s.introSeen);
  const settingsLoaded = useSettingsStore((s) => s.loaded);

  const route = launchRoute({ authLoading, settingsLoaded, ownerId, introSeen });
  return route ? <Redirect href={route} /> : null;
}
