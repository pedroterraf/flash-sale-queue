import QueueFlow from '@/components/QueueFlow';
import StatsPanel from '@/components/StatsPanel';
import AdminControls from '@/components/AdminControls';

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-12 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-fuchsia-400">
          flash-sale-queue
        </p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
          A live demo of a Redis-backed virtual waiting room
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-white/60">
          Standalone, generic version of the rate-limiting pattern I built for a real ticketing
          platform: a FIFO admission queue, a single-node distributed lock protecting the stock
          decrement, and a fail-closed circuit breaker around the downstream dependency. Open two
          tabs and hit &ldquo;Join queue&rdquo; on both to see it play out.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <QueueFlow />
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <StatsPanel />
          </div>
          <AdminControls />
        </div>
      </div>
    </main>
  );
}
