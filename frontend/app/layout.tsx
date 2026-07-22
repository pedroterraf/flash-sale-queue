import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Flash-Sale Queue — live demo',
  description:
    'A Redis-backed virtual waiting room, distributed lock and fail-closed circuit breaker, demoed live.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
