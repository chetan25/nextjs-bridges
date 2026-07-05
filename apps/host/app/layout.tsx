import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '@chetand/share host app',
  description: 'Host app that exposes shared components via @chetand/share',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
