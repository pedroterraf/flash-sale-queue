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
        Demo controls
      </h3>
      <p className="mb-4 text-xs text-white/40">
        Flip &ldquo;simulate outage&rdquo; to make the downstream dependency start failing and
        watch the circuit breaker above trip open — checkout starts failing fast instead of
        hanging, and recovers on its own a few seconds after you turn it back off.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={toggleChaos}
          disabled={busy}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
            chaos ? 'bg-rose-500/20 text-rose-300' : 'bg-white/10 text-white/80 hover:bg-white/20'
          }`}
        >
          {chaos ? '⏹ Stop simulated outage' : '⚡ Simulate downstream outage'}
        </button>
        <button
          onClick={reset}
          disabled={busy}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/20 disabled:opacity-50"
        >
          ↺ Reset demo
        </button>
      </div>
    </div>
  );
}
