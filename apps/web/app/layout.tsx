import type { Metadata } from 'next';
import { AppSharedDepsProvider } from './shared-deps-provider';
import './globals.css';

export const metadata: Metadata = {
  title: '@bridge demos',
  description: 'Demo app for @chetand/lazy-handler, @chetand/hydration, and @chetand/share',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppSharedDepsProvider>{children}</AppSharedDepsProvider>
      </body>
    </html>
  );
}
