'use client';

import { useEffect, useState } from 'react';
import { api, SALE_ID } from '@/lib/api';

export default function AdminControls() {
  const [chaos, setChaos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .stats(SALE_ID)
      .then((data) => {
        if (!cancelled) setChaos(data.chaosEnabled);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo leer el estado de la demo.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleChaos = async () => {
    setBusy(true);
    setError(null);
    try {
      const { chaosEnabled } = await api.setChaos(!chaos);
      setChaos(chaosEnabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el modo caos.');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.reset(SALE_ID);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reiniciar la demo.');
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-white/65">
        Controles de la demo
      </h3>
      <p className="mb-4 text-xs leading-relaxed text-white/55">
        Activá &ldquo;simular caída&rdquo; para que la dependencia downstream empiece a fallar y
        mirá cómo el circuit breaker de arriba se abre — el checkout empieza a fallar rápido en
        vez de colgarse, y se recupera solo unos segundos después de que lo apagues.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={toggleChaos}
          disabled={busy}
          aria-pressed={chaos}
          className={`min-h-11 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
            chaos ? 'bg-rose-500/20 text-rose-200' : 'bg-white/10 text-white/85 hover:bg-white/20'
          }`}
        >
          {busy ? 'Aplicando…' : chaos ? 'Parar la caída simulada' : 'Simular caída downstream'}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={busy}
          className="min-h-11 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/20 disabled:opacity-50"
        >
          Reiniciar demo
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-rose-200">{error}</p>}
    </div>
  );
}
