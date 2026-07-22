'use client';

import { useEffect, useState } from 'react';
import { api, SALE_ID, Stats } from '@/lib/api';

const breakerColor: Record<Stats['breaker']['state'], string> = {
  closed: 'bg-emerald-500/20 text-emerald-300',
  'half-open': 'bg-amber-500/20 text-amber-300',
  open: 'bg-rose-500/20 text-rose-300',
};

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wide text-white/40">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

export default function StatsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await api.stats(SALE_ID);
        if (!cancelled) setStats(data);
      } catch {
        // API might be down/starting — the panel just keeps showing the last known state.
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!stats) {
    return <p className="text-sm text-white/40">Connecting to the API…</p>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">
          Live system state
        </h3>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${breakerColor[stats.breaker.state]}`}>
          circuit breaker: {stats.breaker.state}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="In queue" value={stats.queueDepth} />
        <Stat label="Admitted" value={stats.admittedCount} />
        <Stat label="Stock left" value={`${stats.stock} / ${stats.totalStock}`} />
        <Stat label="Sold" value={stats.soldCount} />
        <Stat label="Admission rate" value={`${stats.admissionRatePerSecond}/s`} />
        <Stat label="Redis" value={stats.redisHealthy ? 'healthy' : 'down'} />
      </div>
    </div>
  );
}
