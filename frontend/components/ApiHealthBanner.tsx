'use client';

import { useEffect, useRef, useState } from 'react';
import { api, SALE_ID } from '@/lib/api';
import { useIntervalWhenVisible } from '@/lib/useIntervalWhenVisible';

const SLOW_MS = 2000;
const RETRY_MS = 4000;

export default function ApiHealthBanner() {
  const [visible, setVisible] = useState(false);
  const [cold, setCold] = useState(false);
  const [connected, setConnected] = useState(false);

  const showTimerRef = useRef<number | null>(null);

  useEffect(() => {
    showTimerRef.current = window.setTimeout(() => setVisible(true), SLOW_MS);
    return () => {
      if (showTimerRef.current !== null) window.clearTimeout(showTimerRef.current);
    };
  }, []);

  useIntervalWhenVisible(async () => {
    if (connected) return;
    try {
      await api.stats(SALE_ID);
      if (showTimerRef.current !== null) window.clearTimeout(showTimerRef.current);
      setVisible(false);
      setCold(false);
      setConnected(true);
    } catch {
      setVisible(true);
      setCold(true);
    }
  }, RETRY_MS);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="mb-6 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
    >
      {cold
        ? 'La primera carga puede tardar ~30s — el server gratuito estaba dormido. Esta página reintenta sola.'
        : 'Conectando con la API…'}
    </div>
  );
}
