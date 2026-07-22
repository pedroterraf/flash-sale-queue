'use client';

import { useState } from 'react';
import { api, SALE_ID } from '@/lib/api';

export default function AdminControls() {
  const [chaos, setChaos] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggleChaos = async () => {
    setBusy(true);
    const { chaosEnabled } = await api.setChaos(!chaos);
    setChaos(chaosEnabled);
    setBusy(false);
  };

  const reset = async () => {
    setBusy(true);
    await api.reset(SALE_ID);
    setBusy(false);
    window.location.reload();
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-white/60">
        Controles de la demo
      </h3>
      <p className="mb-4 text-xs text-white/40">
        Activá &ldquo;simular caída&rdquo; para que la dependencia downstream empiece a fallar y
        mirá cómo el circuit breaker de arriba se abre — el checkout empieza a fallar rápido en
        vez de colgarse, y se recupera solo unos segundos después de que lo apagues.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={toggleChaos}
          disabled={busy}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
            chaos ? 'bg-rose-500/20 text-rose-300' : 'bg-white/10 text-white/80 hover:bg-white/20'
          }`}
        >
          {chaos ? '⏹ Parar la caída simulada' : '⚡ Simular caída downstream'}
        </button>
        <button
          onClick={reset}
          disabled={busy}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/20 disabled:opacity-50"
        >
          ↺ Reiniciar demo
        </button>
      </div>
    </div>
  );
}
