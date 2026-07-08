import type { Metadata } from 'next';
import { AppSharedDepsProvider } from './shared-deps-provider';
import './globals.css';

export const metadata: Metadata = {
  title: '@bridge demos',
  description: 'Demo app for @nextjs-bridges/lazy-handler, @nextjs-bridges/hydration, and @nextjs-bridges/share',
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
