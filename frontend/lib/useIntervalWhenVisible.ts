'use client';

import { useEffect, useRef } from 'react';

export function useIntervalWhenVisible(callback: () => void | Promise<void>, ms: number) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let cancelled = false;

    const run = () => {
      if (cancelled || document.visibilityState === 'hidden') return;
      void callbackRef.current();
    };

    run();
    const interval = window.setInterval(run, ms);
    document.addEventListener('visibilitychange', run);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', run);
    };
  }, [ms]);
}
