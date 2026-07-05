import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '@chetand/share storefront app',
  description: 'Storefront app exposing HomeWidget and PopularProductsPanel via @chetand/share',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
