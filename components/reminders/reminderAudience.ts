import { ownerIdOf, useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useChildStore } from '@/stores/childStore';

/** Recheck the owner and active child after waiting for a gate or a system dialog. */
export function canManageReminders(ownerId: string, childId: string): boolean {
  const auth = useAuthStore.getState();
  const family = useChildStore.getState();
  const settings = useSettingsStore.getState();
  return settings.loaded && settings.reminders.ownerId === ownerId && auth.consent === 'ok'
    && ownerIdOf(auth) === ownerId
    && family.activeChildId === childId
    && family.children.some((child) => child.id === childId && !child.kidMode && !child.archivedAt);
}


let settingsAccess: { ownerId: string; childId: string } | null = null;

/** The Adultos gate grants access to one settings screen for the active child. */
export function grantReminderSettingsAccess(ownerId: string, childId: string): boolean {
  if (!canManageReminders(ownerId, childId)) return false;
  settingsAccess = { ownerId, childId };
  return true;
}

export function hasReminderSettingsAccess(ownerId: string, childId: string): boolean {
  return settingsAccess?.ownerId === ownerId && settingsAccess.childId === childId && canManageReminders(ownerId, childId);
}

export function revokeReminderSettingsAccess(ownerId: string, childId: string) {
  if (settingsAccess?.ownerId === ownerId && settingsAccess.childId === childId) settingsAccess = null;
}
