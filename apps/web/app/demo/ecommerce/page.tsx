'use client';
import { HydrationBoundary } from '@nextjs-bridges/hydration';
import { RemoteComponent } from '@nextjs-bridges/share';
import { Header } from './components/header';
import { Footer } from './components/footer';
import { PanelSkeleton } from './components/panel-skeleton';

const STOREFRONT_MANIFEST = 'http://localhost:3002/share-manifest.json';

export default function EcommerceDemoPage() {
  return (
    <>
      <Header />
      <main style={{ display: 'flex', gap: '1.5rem', padding: '1.5rem', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <RemoteComponent
            manifestUrl={STOREFRONT_MANIFEST}
            expose="./HomeWidget"
            fallback={<p>Loading home widget…</p>}
            errorFallback={<p>Home widget unavailable.</p>}
          />
        </div>
        <aside style={{ width: 260 }}>
          <HydrationBoundary strategy="visible" fallback={<PanelSkeleton />}>
            <RemoteComponent
              manifestUrl={STOREFRONT_MANIFEST}
              expose="./PopularProductsPanel"
              fallback={<PanelSkeleton />}
              errorFallback={<p>Recommendations unavailable.</p>}
            />
          </HydrationBoundary>
        </aside>
      </main>
      <Footer />
    </>
  );
}
