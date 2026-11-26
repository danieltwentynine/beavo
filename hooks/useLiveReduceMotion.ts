import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

let preference: boolean | null = null;
let stopListening: (() => void) | undefined;
const listeners = new Set<() => void>();

function publish(value: boolean) {
  if (preference === value) return;
  preference = value;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!stopListening) {
    let receivedEvent = false;
    let active = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      receivedEvent = true;
      publish(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active && !receivedEvent) publish(value);
    }).catch(() => { /* Keep the launch preference if querying the OS failed. */ });
    stopListening = () => {
      active = false;
      subscription.remove();
    };
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size !== 0) return;
    stopListening?.();
    stopListening = undefined;
  };
}

const getPreference = () => preference;

/** Uses the launch setting until the shared native subscription reads the current one. */
export function useLiveReduceMotion() {
  const initial = useReducedMotion();
  return useSyncExternalStore(subscribe, getPreference, getPreference) ?? initial;
}
