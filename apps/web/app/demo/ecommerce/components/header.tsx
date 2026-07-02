'use client';
import { HydrationBoundary } from '@bridge/hydration';
import { RemoteComponent } from '@bridge/share';
import { StaticCartIcon } from './static-cart-icon';

const HOST_MANIFEST = 'http://localhost:3001/share-manifest.json';

export function Header() {
  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 1.5rem',
        borderBottom: '1px solid #e2e8f0',
      }}
    >
      <strong style={{ fontSize: '1.1rem' }}>bridges • shop</strong>
      <nav style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem', color: '#475569' }}>
        <span>Home</span>
        <span>Categories</span>
        <span>Deals</span>
      </nav>
      <HydrationBoundary strategy="idle" fallback={<StaticCartIcon />}>
        <RemoteComponent
          manifestUrl={HOST_MANIFEST}
          expose="./CartWidget"
          fallback={<StaticCartIcon />}
          errorFallback={<StaticCartIcon />}
        />
      </HydrationBoundary>
    </header>
  );
}
