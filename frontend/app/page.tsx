import QueueFlow from '@/components/QueueFlow';
import StatsPanel from '@/components/StatsPanel';
import AdminControls from '@/components/AdminControls';
import AdmissionRateChart from '@/components/AdmissionRateChart';

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-12 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-fuchsia-400">
          flash-sale-queue
        </p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
          Demo en vivo de una sala de espera virtual con Redis
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-white/60">
          Versión standalone y genérica del patrón de rate-limiting que construí para una
          plataforma de ticketing real: una cola de admisión FIFO, un lock distribuido de un solo
          nodo protegiendo el descuento de stock, y un circuit breaker fail-closed alrededor de la
          dependencia downstream. Abrí dos pestañas y apretá &ldquo;Unirme a la cola&rdquo; en
          ambas para verlo en acción.
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

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
        <AdmissionRateChart />
      </div>
    </main>
  );
}
