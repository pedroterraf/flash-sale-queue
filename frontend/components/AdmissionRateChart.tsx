'use client';

import { useState } from 'react';
import { api, SALE_ID } from '@/lib/api';
import { useIntervalWhenVisible } from '@/lib/useIntervalWhenVisible';

const SECONDS_WINDOW = 30;
const WIDTH = 640;
const HEIGHT = 220;
const PAD = { top: 22, right: 12, bottom: 24, left: 8 };
const CHART_W = WIDTH - PAD.left - PAD.right;
const CHART_H = HEIGHT - PAD.top - PAD.bottom;
const BAR_GAP = 3;

export default function AdmissionRateChart() {
  const [buckets, setBuckets] = useState<{ second: number; count: number }[]>([]);
  const [rate, setRate] = useState(8);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  useIntervalWhenVisible(async () => {
    try {
      const data = await api.timeseries(SALE_ID, SECONDS_WINDOW);
      setBuckets(data.buckets);
      setRate(data.ratePerSecond);
      setReady(true);
    } catch {
      setReady(true);
    }
  }, 1000);

  const maxValue = Math.max(rate * 1.5, ...buckets.map((b) => b.count), 1);
  const barWidth = buckets.length > 0 ? CHART_W / buckets.length - BAR_GAP : 0;
  const yFor = (value: number) => PAD.top + CHART_H - (value / maxValue) * CHART_H;
  const rateY = yFor(rate);
  const hovered = hoverIdx !== null ? buckets[hoverIdx] : null;
  const hasAdmissions = buckets.some((b) => b.count > 0);

  return (
    <div>
      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
          Admisiones por segundo
        </h2>
        <span className="font-mono text-xs text-white/55">
          últimos {buckets.length || SECONDS_WINDOW}s · límite {rate}/s
        </span>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-white/55">
        Las mismas keys del token-bucket que usa el limitador — no una métrica aparte. Unite a la
        cola para ver las barras crecer sin pasar la línea punteada.
      </p>

      {!ready && <p className="text-sm text-white/60">Cargando el gráfico…</p>}

      {ready && (
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
              stroke="rgba(255,255,255,0.08)"
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
                  onClick={() => setHoverIdx(i)}
                />
                <rect
                  x={x}
                  y={y}
                  width={Math.max(barWidth, 1)}
                  height={barH}
                  rx={2}
                  fill={isHover ? '#c4b5fd' : '#8b5cf6'}
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
          <text
            x={PAD.left}
            y={rateY - 6}
            fontSize={11}
            fill="#f9a8d4"
            fontWeight={600}
            fontFamily="var(--font-mono), ui-monospace, monospace"
          >
            límite configurado: {rate}/s
          </text>

          {hovered && hoverIdx !== null && (
            <g>
              {(() => {
                const x = PAD.left + hoverIdx * (barWidth + BAR_GAP) + barWidth / 2;
                const boxW = 86;
                const boxX = Math.min(Math.max(x - boxW / 2, PAD.left), WIDTH - PAD.right - boxW);
                return (
                  <g transform={`translate(${boxX}, 2)`}>
                    <rect
                      width={boxW}
                      height={18}
                      rx={4}
                      fill="#18122b"
                      stroke="rgba(255,255,255,0.2)"
                    />
                    <text
                      x={boxW / 2}
                      y={13}
                      textAnchor="middle"
                      fontSize={11}
                      fill="#eef1ff"
                      fontFamily="var(--font-mono), ui-monospace, monospace"
                    >
                      {hovered.count} admisiones
                    </text>
                  </g>
                );
              })()}
            </g>
          )}
        </svg>
      )}

      <p className="mt-1 text-xs text-white/55">
        {hovered
          ? `hace ${buckets.length - 1 - (hoverIdx ?? 0)}s — ${hovered.count} admisiones ese segundo`
          : hasAdmissions
            ? 'Pasá el mouse o tocá una barra para ver el detalle.'
            : 'Todavía no hubo admisiones en esta ventana. Unite a la cola para poblar el gráfico.'}
      </p>
    </div>
  );
}
