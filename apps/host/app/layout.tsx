import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '@nextjs-bridges/share host app',
  description: 'Host app that exposes shared components via @nextjs-bridges/share',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
