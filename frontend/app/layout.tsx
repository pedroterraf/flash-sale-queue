import type { Metadata } from 'next';
import { IBM_Plex_Mono, Source_Sans_3 } from 'next/font/google';
import './globals.css';

const sans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Flash-Sale Queue — demo en vivo',
  description:
    'Sala de espera virtual con Redis, lock distribuido y circuit breaker fail-closed, demostrado en vivo.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
