import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Start opaque while waiting for the OS preference. */
export function useReduceTransparency(): boolean {
  const [reduceTransparency, setReduceTransparency] = useState(true);
  useEffect(() => {
    let alive = true;
    let receivedEvent = false;
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', (value) => {
      receivedEvent = true;
      setReduceTransparency(value);
    });
    void AccessibilityInfo.isReduceTransparencyEnabled().then((value) => {
      if (alive && !receivedEvent) setReduceTransparency(value);
    }).catch(() => { /* Keep the opaque fallback if querying the OS failed. */ });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduceTransparency;
}
