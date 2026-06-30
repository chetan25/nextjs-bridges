import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '@bridge demos',
  description: 'Demo app for @bridge/lazy-handler, @bridge/hydration, and @bridge/share',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
