import QueueFlow from '@/components/QueueFlow';
import StatsPanel from '@/components/StatsPanel';
import AdminControls from '@/components/AdminControls';
import AdmissionRateChart from '@/components/AdmissionRateChart';
import ApiHealthBanner from '@/components/ApiHealthBanner';

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6 text-center sm:mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300 sm:text-sm">
          flash-sale-queue
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-4xl">
          Demo en vivo de una sala de espera virtual con Redis
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-white/70 sm:text-base">
          Cola FIFO, lock distribuido de un solo nodo y circuit breaker fail-closed — el mismo
          patrón que usé en un sistema de ticketing de alta demanda.
        </p>
      </header>

      <ApiHealthBanner />

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <AdmissionRateChart />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <QueueFlow />
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <StatsPanel />
          </div>
          <AdminControls />
        </div>
      </div>
    </main>
  );
}
