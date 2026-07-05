import type { Metadata } from 'next';
import { BridgeSharedDepsProvider } from '@chetand/share';
import './globals.css';

export const metadata: Metadata = {
  title: '@bridge demos',
  description: 'Demo app for @chetand/lazy-handler, @chetand/hydration, and @chetand/share',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <BridgeSharedDepsProvider>{children}</BridgeSharedDepsProvider>
      </body>
    </html>
  );
}
