'use client';
import { HydrationBoundary } from '@nextjs-bridges/hydration';
import { RemoteComponent } from '@nextjs-bridges/share';
import { useLazyHandler } from '@nextjs-bridges/lazy-handler/use-lazy-handler';
import { StaticCartIcon } from './static-cart-icon';

const HOST_MANIFEST = 'http://localhost:3001/share-manifest.json';

// Shared across this demo's shell-owned files (duplicated, not imported —
// each remote bundles independently, so these files use the same small
// literal rather than reaching for a shared package for a one-line style).
const SHELL_TAG_STYLE = {
  fontFamily: 'ui-monospace, monospace',
  fontSize: '0.7rem',
  color: '#334155',
  background: '#f1f5f9',
  border: '1px solid #e2e8f0',
  borderRadius: 4,
  padding: '0.1rem 0.4rem',
} as const;

export function Header() {
  const [categoriesRef] = useLazyHandler<HTMLButtonElement>(
    () => import('../handlers/open-categories-menu'),
    { preloadOn: 'hover' },
  );

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <strong style={{ fontSize: '1.1rem' }}>bridges • shop</strong>
        <span style={SHELL_TAG_STYLE}>[shell]</span>
      </div>
      <nav style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem', color: '#475569' }}>
        <span>Home</span>
        <button
          ref={categoriesRef}
          style={{
            font: 'inherit',
            color: 'inherit',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          Categories
        </button>
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
