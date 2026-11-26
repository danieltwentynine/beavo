import { useEffect, useRef, useState } from 'react';

import { clearStale, reportListenerError, retryDelayMs } from '@/lib/errors';
import type { StaleSource } from '@/stores/noticeStore';

/**
 * A failed Firestore listener has stopped for good. This keeps one alive:
 * `subscribe(onError)` runs while `key` is set, and again after a failure,
 * with a growing delay (lib/errors.ts retryDelayMs). The data is marked stale
 * from the failure until the next successful emission (`onLive`).
 */
export function useRetryingWatch(
  source: StaleSource,
  key: string | null,
  subscribe: (onError: (error: unknown) => void, onLive: () => void) => () => void,
): void {
  const [attempt, setAttempt] = useState(0);
  const failures = useRef(0);
  const subscribeRef = useRef(subscribe);
  subscribeRef.current = subscribe;

  useEffect(() => {
    failures.current = 0;
    clearStale(source);
  }, [source, key]);

  useEffect(() => {
    if (!key) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = true;
    const stop = subscribeRef.current(
      (error) => {
        if (!active) return;
        failures.current += 1;
        reportListenerError(source, error);
        timer = setTimeout(() => setAttempt((a) => a + 1), retryDelayMs(failures.current));
      },
      () => {
        if (failures.current > 0) clearStale(source);
        failures.current = 0;
      },
    );
    return () => {
      active = false;
      clearTimeout(timer);
      stop();
    };
  }, [source, key, attempt]);
}
