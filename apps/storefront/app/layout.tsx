import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '@bridge/share storefront app',
  description: 'Storefront app exposing HomeWidget and PopularProductsPanel via @bridge/share',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
