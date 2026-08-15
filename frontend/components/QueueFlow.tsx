'use client';

import { useEffect, useRef, useState } from 'react';
import { api, isRetryableCheckout, SALE_ID } from '@/lib/api';

const POLL_INTERVAL_MS = 700;

type Phase =
  | { kind: 'idle' }
  | { kind: 'joining' }
  | { kind: 'waiting'; queueId: string; position: number; queueDepth: number; etaSeconds: number }
  | { kind: 'admitted'; ticket: string }
  | { kind: 'purchasing'; ticket: string }
  | { kind: 'purchased'; unitNumber: number }
  | { kind: 'sold_out' }
  | { kind: 'error'; message: string; ticket?: string; retryable: boolean };

function waitingProgress(position: number, queueDepth: number): number {
  if (queueDepth <= 0 || position <= 0) return 8;
  return Math.min(100, Math.max(6, Math.round(((queueDepth - position + 1) / queueDepth) * 100)));
}

export default function QueueFlow() {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current);
    },
    [],
  );

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const applyStatus = (queueId: string, result: Awaited<ReturnType<typeof api.status>>) => {
    if (result.status === 'admitted') {
      stopPolling();
      setPhase({ kind: 'admitted', ticket: result.ticket });
      return;
    }
    setPhase({
      kind: 'waiting',
      queueId,
      position: result.position,
      queueDepth: result.queueDepth,
      etaSeconds: Math.round(result.estimatedWaitSeconds),
    });
  };

  const startPolling = (queueId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const result = await api.status(SALE_ID, queueId);
        applyStatus(queueId, result);
      } catch (error) {
        stopPolling();
        setPhase({
          kind: 'error',
          message: error instanceof Error ? error.message : 'No se pudo leer el estado de la cola',
          retryable: false,
        });
      }
    }, POLL_INTERVAL_MS);
  };

  const join = async () => {
    setPhase({ kind: 'joining' });
    try {
      const { queueId } = await api.join(SALE_ID);
      const result = await api.status(SALE_ID, queueId);
      applyStatus(queueId, result);
      if (result.status === 'waiting') {
        startPolling(queueId);
      }
    } catch (error) {
      setPhase({
        kind: 'error',
        message: error instanceof Error ? error.message : 'No se pudo unir a la cola',
        retryable: false,
      });
    }
  };

  const buy = async (ticket: string) => {
    setPhase({ kind: 'purchasing', ticket });
    try {
      const body = await api.checkout(ticket);
      if (body.status === 'purchased') {
        setPhase({ kind: 'purchased', unitNumber: body.unitNumber });
        return;
      }
      setPhase({ kind: 'sold_out' });
    } catch (error) {
      setPhase({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Falló el checkout',
        ticket,
        retryable: isRetryableCheckout(error),
      });
    }
  };

  const reset = () => {
    stopPolling();
    setPhase({ kind: 'idle' });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-8">
      <div className="mb-6">
        <span className="rounded-full bg-fuchsia-600/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-fuchsia-300">
          Drop limitado
        </span>
        <h2 className="mt-3 text-xl font-bold sm:text-2xl">Venta flash — Zapatillas X, 300 pares</h2>
        <p className="mt-1 text-sm text-white/65">
          Todos aprietan &ldquo;Unirme a la cola&rdquo; al mismo tiempo. La sala de espera admite
          gente a una tasa fija para que el checkout nunca vea más tráfico del que puede manejar.
        </p>
      </div>

      {phase.kind === 'idle' && (
        <div>
          <p className="mb-4 text-sm leading-relaxed text-white/75">
            Abrí otra pestaña, unite a la cola en ambas, y después activá &ldquo;Simular caída
            downstream&rdquo;. Vas a ver tu posición, el circuit breaker y el gráfico de
            admisiones en vivo.
          </p>
          <button
            type="button"
            onClick={join}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 py-3 font-semibold transition hover:opacity-90"
          >
            Unirme a la cola
          </button>
        </div>
      )}

      {phase.kind === 'joining' && (
        <p className="text-sm text-white/70" aria-live="polite">
          Anotándote en la cola…
        </p>
      )}

      {phase.kind === 'waiting' && (
        <div aria-live="polite">
          <div className="flex items-center justify-between text-sm text-white/65">
            <span>Posición</span>
            <span>Tiempo estimado</span>
          </div>
          <div className="mt-1 flex items-end justify-between">
            <span className="font-mono text-4xl font-semibold">#{phase.position}</span>
            <span className="text-lg text-white/80">~{phase.etaSeconds}s</span>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-fuchsia-500 transition-[width] duration-500"
              style={{ width: `${waitingProgress(phase.position, phase.queueDepth)}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-white/60">
            {phase.queueDepth} {phase.queueDepth === 1 ? 'persona esperando' : 'personas esperando'}{' '}
            ahora mismo.
          </p>
        </div>
      )}

      {phase.kind === 'admitted' && (
        <div>
          <p className="mb-4 rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Ya estás adentro. Tu ticket de admisión es válido por un par de minutos.
          </p>
          <button
            type="button"
            onClick={() => buy(phase.ticket)}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 font-semibold transition hover:opacity-90"
          >
            Comprar ahora
          </button>
        </div>
      )}

      {phase.kind === 'purchasing' && (
        <p className="text-white/70" aria-live="polite">
          Confirmando tu compra…
        </p>
      )}

      {phase.kind === 'purchased' && (
        <div>
          <p className="rounded-lg bg-emerald-500/10 px-4 py-3 text-emerald-200">
            Comprado. Te tocó la unidad #{phase.unitNumber}.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 text-sm text-white/60 underline underline-offset-2 hover:text-white/80"
          >
            Empezar de nuevo
          </button>
        </div>
      )}

      {phase.kind === 'sold_out' && (
        <div>
          <p className="rounded-lg bg-amber-500/10 px-4 py-3 text-amber-200">
            Se agotó — mejor suerte en el próximo drop.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 text-sm text-white/60 underline underline-offset-2 hover:text-white/80"
          >
            Empezar de nuevo
          </button>
        </div>
      )}

      {phase.kind === 'error' && (
        <div>
          <p className="rounded-lg bg-rose-500/10 px-4 py-3 text-rose-200">{phase.message}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {phase.retryable && phase.ticket && (
              <button
                type="button"
                onClick={() => buy(phase.ticket as string)}
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
              >
                Reintentar compra
              </button>
            )}
            <button
              type="button"
              onClick={reset}
              className="text-sm text-white/60 underline underline-offset-2 hover:text-white/80"
            >
              Empezar de nuevo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
