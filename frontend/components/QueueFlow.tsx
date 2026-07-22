'use client';

import { useEffect, useRef, useState } from 'react';
import { api, SALE_ID } from '@/lib/api';

type Phase =
  | { kind: 'idle' }
  | { kind: 'waiting'; queueId: string; position: number; queueDepth: number; etaSeconds: number }
  | { kind: 'admitted'; ticket: string }
  | { kind: 'purchasing' }
  | { kind: 'purchased'; unitNumber: number }
  | { kind: 'sold_out' }
  | { kind: 'error'; message: string };

export default function QueueFlow() {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const join = async () => {
    const { queueId } = await api.join(SALE_ID);
    setPhase({ kind: 'waiting', queueId, position: 0, queueDepth: 0, etaSeconds: 0 });

    pollRef.current = setInterval(async () => {
      const result = await api.status(SALE_ID, queueId);
      if (result.status === 'admitted') {
        stopPolling();
        setPhase({ kind: 'admitted', ticket: result.ticket });
      } else {
        setPhase({
          kind: 'waiting',
          queueId,
          position: result.position,
          queueDepth: result.queueDepth,
          etaSeconds: Math.round(result.estimatedWaitSeconds),
        });
      }
    }, 700);
  };

  const buy = async (ticket: string) => {
    setPhase({ kind: 'purchasing' });
    const { body } = await api.checkout(ticket);
    if ('status' in body && body.status === 'purchased') {
      setPhase({ kind: 'purchased', unitNumber: body.unitNumber });
    } else if ('status' in body && body.status === 'sold_out') {
      setPhase({ kind: 'sold_out' });
    } else {
      setPhase({ kind: 'error', message: 'message' in body ? body.message : 'Checkout failed' });
    }
  };

  const reset = () => {
    stopPolling();
    setPhase({ kind: 'idle' });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
      <div className="mb-6">
        <span className="rounded-full bg-fuchsia-600/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-fuchsia-300">
          Limited drop
        </span>
        <h2 className="mt-3 text-2xl font-bold">Flash Sale — Sneaker X, 300 pairs</h2>
        <p className="mt-1 text-sm text-white/60">
          Everyone hits &ldquo;Join queue&rdquo; at the same time. The waiting room admits people
          at a fixed rate so checkout never sees more traffic than it can handle.
        </p>
      </div>

      {phase.kind === 'idle' && (
        <button
          onClick={join}
          className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 py-3 font-semibold transition hover:opacity-90"
        >
          Join queue
        </button>
      )}

      {phase.kind === 'waiting' && (
        <div>
          <div className="flex items-center justify-between text-sm text-white/60">
            <span>Position</span>
            <span>ETA</span>
          </div>
          <div className="mt-1 flex items-end justify-between">
            <span className="text-4xl font-bold">#{phase.position}</span>
            <span className="text-lg text-white/80">~{phase.etaSeconds}s</span>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full animate-pulse rounded-full bg-fuchsia-500" style={{ width: '40%' }} />
          </div>
          <p className="mt-3 text-xs text-white/50">{phase.queueDepth} people waiting right now.</p>
        </div>
      )}

      {phase.kind === 'admitted' && (
        <div>
          <p className="mb-4 rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            You&apos;re in! Your admission ticket is valid for a couple of minutes.
          </p>
          <button
            onClick={() => buy(phase.ticket)}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 font-semibold transition hover:opacity-90"
          >
            Buy now
          </button>
        </div>
      )}

      {phase.kind === 'purchasing' && <p className="text-white/70">Confirming your order…</p>}

      {phase.kind === 'purchased' && (
        <div>
          <p className="rounded-lg bg-emerald-500/10 px-4 py-3 text-emerald-300">
            🎉 Purchased! You got unit #{phase.unitNumber}.
          </p>
          <button onClick={reset} className="mt-4 text-sm text-white/50 underline">
            Start over
          </button>
        </div>
      )}

      {phase.kind === 'sold_out' && (
        <div>
          <p className="rounded-lg bg-amber-500/10 px-4 py-3 text-amber-300">
            Sold out — better luck next drop.
          </p>
          <button onClick={reset} className="mt-4 text-sm text-white/50 underline">
            Start over
          </button>
        </div>
      )}

      {phase.kind === 'error' && (
        <div>
          <p className="rounded-lg bg-rose-500/10 px-4 py-3 text-rose-300">{phase.message}</p>
          <button onClick={reset} className="mt-4 text-sm text-white/50 underline">
            Start over
          </button>
        </div>
      )}
    </div>
  );
}
