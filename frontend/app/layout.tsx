import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Flash-Sale Queue — demo en vivo',
  description:
    'Sala de espera virtual con Redis, lock distribuido y circuit breaker fail-closed, demostrado en vivo.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
