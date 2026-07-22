'use client';

import { useEffect, useState } from 'react';
import { api, SALE_ID } from '@/lib/api';

const SECONDS_WINDOW = 30;
const WIDTH = 640;
const HEIGHT = 180;
const PAD = { top: 14, right: 12, bottom: 20, left: 8 };
const CHART_W = WIDTH - PAD.left - PAD.right;
const CHART_H = HEIGHT - PAD.top - PAD.bottom;
const BAR_GAP = 3;

export default function AdmissionRateChart() {
  const [buckets, setBuckets] = useState<{ second: number; count: number }[]>([]);
  const [rate, setRate] = useState(8);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await api.timeseries(SALE_ID, SECONDS_WINDOW);
        if (!cancelled) {
          setBuckets(data.buckets);
          setRate(data.ratePerSecond);
        }
      } catch {
        // el panel de stats ya avisa si la API no responde
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const maxValue = Math.max(rate * 1.5, ...buckets.map((b) => b.count), 1);
  const barWidth = buckets.length > 0 ? CHART_W / buckets.length - BAR_GAP : 0;
  const yFor = (value: number) => PAD.top + CHART_H - (value / maxValue) * CHART_H;
  const rateY = yFor(rate);
  const hovered = hoverIdx !== null ? buckets[hoverIdx] : null;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">
          Admisiones por segundo
        </h3>
        <span className="text-xs text-white/40">últimos {buckets.length || SECONDS_WINDOW}s</span>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`Admisiones por segundo en los últimos ${SECONDS_WINDOW} segundos, con un límite configurado de ${rate} por segundo`}
      >
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={PAD.top + CHART_H * (1 - f)}
            y2={PAD.top + CHART_H * (1 - f)}
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={1}
          />
        ))}

        {buckets.map((b, i) => {
          const x = PAD.left + i * (barWidth + BAR_GAP);
          const barH = Math.max((b.count / maxValue) * CHART_H, b.count > 0 ? 2 : 0);
          const y = PAD.top + CHART_H - barH;
          const isHover = hoverIdx === i;
          return (
            <g key={b.second}>
              <rect
                x={x}
                y={PAD.top}
                width={Math.max(barWidth, 1)}
                height={CHART_H}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx((cur) => (cur === i ? null : cur))}
              />
              <rect
                x={x}
                y={y}
                width={Math.max(barWidth, 1)}
                height={barH}
                rx={2}
                fill={isHover ? '#a78bfa' : '#8b5cf6'}
              />
            </g>
          );
        })}

        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={rateY}
          y2={rateY}
          stroke="#f472b6"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <text x={PAD.left} y={rateY - 5} fontSize={10} fill="#f472b6" fontWeight={600}>
          límite configurado: {rate}/s
        </text>

        {hovered && hoverIdx !== null && (
          <g>
            {(() => {
              const x = PAD.left + hoverIdx * (barWidth + BAR_GAP) + barWidth / 2;
              const boxW = 74;
              const boxX = Math.min(Math.max(x - boxW / 2, PAD.left), WIDTH - PAD.right - boxW);
              return (
                <g transform={`translate(${boxX}, 2)`}>
                  <rect width={boxW} height={16} rx={4} fill="#18122b" stroke="rgba(255,255,255,0.15)" />
                  <text x={boxW / 2} y={11} textAnchor="middle" fontSize={10} fill="#eef1ff">
                    {hovered.count} admisiones
                  </text>
                </g>
              );
            })()}
          </g>
        )}
      </svg>

      <p className="mt-1 text-xs text-white/40">
        {hovered
          ? `hace ${buckets.length - 1 - (hoverIdx ?? 0)}s — ${hovered.count} admisiones ese segundo`
          : 'Pasá el mouse por una barra para ver el detalle.'}
      </p>
    </div>
  );
}
