'use client';

import { useEffect, useState } from 'react';
import { api, SALE_ID, Stats } from '@/lib/api';

const breakerColor: Record<Stats['breaker']['state'], string> = {
  closed: 'bg-emerald-500/20 text-emerald-300',
  'half-open': 'bg-amber-500/20 text-amber-300',
  open: 'bg-rose-500/20 text-rose-300',
};

const breakerLabel: Record<Stats['breaker']['state'], string> = {
  closed: 'cerrado',
  'half-open': 'semiabierto',
  open: 'abierto',
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
        // si la API está caída o iniciando, el panel sigue mostrando el último estado conocido
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
    return <p className="text-sm text-white/40">Conectando con la API…</p>;
  }

  const stockPct = stats.totalStock > 0 ? Math.round((stats.stock / stats.totalStock) * 100) : 0;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">
          Estado del sistema en vivo
        </h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${breakerColor[stats.breaker.state]}`}
        >
          circuit breaker: {breakerLabel[stats.breaker.state]}
        </span>
      </div>

      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between text-xs text-white/50">
          <span>Stock disponible</span>
          <span>
            {stats.stock} / {stats.totalStock}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-[width] duration-500"
            style={{ width: `${stockPct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="En cola" value={stats.queueDepth} />
        <Stat label="Admitidos" value={stats.admittedCount} />
        <Stat label="Vendidas" value={stats.soldCount} />
        <Stat label="Tasa de admisión" value={`${stats.admissionRatePerSecond}/s`} />
        <Stat label="Redis" value={stats.redisHealthy ? 'sano' : 'caído'} />
      </div>
    </div>
  );
}
