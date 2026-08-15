'use client';

import { useState } from 'react';
import { api, SALE_ID, Stats } from '@/lib/api';
import { useIntervalWhenVisible } from '@/lib/useIntervalWhenVisible';

const breakerColor: Record<Stats['breaker']['state'], string> = {
  closed: 'bg-emerald-500/20 text-emerald-200',
  'half-open': 'bg-amber-500/20 text-amber-200',
  open: 'bg-rose-500/20 text-rose-200',
};

const breakerLabel: Record<Stats['breaker']['state'], string> = {
  closed: 'cerrado',
  'half-open': 'semiabierto',
  open: 'abierto',
};

function Stat({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4">
      <div className="text-xs uppercase tracking-wide text-white/55">{label}</div>
      <div className={`mt-1 font-mono text-xl font-semibold sm:text-2xl ${warn ? 'text-rose-300' : ''}`}>
        {value}
      </div>
    </div>
  );
}

export default function StatsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  useIntervalWhenVisible(async () => {
    try {
      const data = await api.stats(SALE_ID);
      setStats(data);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, 1000);

  if (!stats) {
    return (
      <p className="text-sm text-white/60">
        {failed
          ? 'No se pudo leer el estado. Si es la primera carga, el server puede tardar ~30s en despertar.'
          : 'Conectando con la API…'}
      </p>
    );
  }

  const stockPct = stats.totalStock > 0 ? Math.round((stats.stock / stats.totalStock) * 100) : 0;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white/65">
          Estado del sistema en vivo
        </h3>
        <div className="flex flex-wrap gap-2">
          {stats.chaosEnabled && (
            <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200">
              caída simulada
            </span>
          )}
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${breakerColor[stats.breaker.state]}`}
          >
            circuit breaker: {breakerLabel[stats.breaker.state]}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between text-xs text-white/60">
          <span>Stock disponible</span>
          <span className="font-mono">
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
        <Stat
          label="Redis"
          value={stats.redisHealthy ? 'sano' : 'caído'}
          warn={!stats.redisHealthy}
        />
      </div>
    </div>
  );
}
