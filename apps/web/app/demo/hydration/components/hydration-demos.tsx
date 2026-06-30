'use client';
import { useState } from 'react';
import { HydrationBoundary, useHydrationState } from '@bridge/hydration';
import { HeavyWidget } from './heavy-widget';

// Fallback skeleton used across all demos
function Skeleton({ label }: { label: string }) {
  return (
    <div style={{
      background: '#f1f5f9',
      border: '2px dashed #94a3b8',
      padding: '1rem',
      borderRadius: 8,
      color: '#64748b',
    }}>
      ⏳ {label} — not yet hydrated
    </div>
  );
}

// Manual strategy: the button lives in the fallback slot so it can reach the context
function ManualFallback({ label }: { label: string }) {
  const { hydrateNow } = useHydrationState();
  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <Skeleton label={label} />
      <button
        onClick={hydrateNow}
        style={{ padding: '0.5rem 1rem', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
      >
        Hydrate now
      </button>
    </div>
  );
}

// Tracks hydration events for the onHydrate callback demo
function HydrateTracker() {
  const [events, setEvents] = useState<string[]>([]);
  return (
    <>
      <HydrationBoundary
        strategy="visible"
        fallback={<Skeleton label="onHydrate callback target" />}
        onHydrate={() => setEvents((e) => [...e, new Date().toLocaleTimeString()])}
      >
        <HeavyWidget label="onHydrate target" color="#fef9c3" />
      </HydrationBoundary>
      {events.length > 0 && (
        <p style={{ marginTop: 8 }}>
          onHydrate fired at: <strong>{events.join(', ')}</strong>
        </p>
      )}
    </>
  );
}

export function HydrationDemos() {
  return (
    <div className="demos">

      {/* 1. eager */}
      <section>
        <h2>1 · eager — renders immediately</h2>
        <p>No deferral. Should look identical to not using a boundary at all.</p>
        <HydrationBoundary strategy="eager">
          <HeavyWidget label="Eager" color="#dcfce7" />
        </HydrationBoundary>
      </section>

      {/* 2. visible */}
      <section>
        <h2>2 · visible — hydrates on scroll</h2>
        <p>Component hydrates when scrolled into the viewport (IntersectionObserver threshold 0.1).</p>
        <HydrationBoundary strategy="visible" fallback={<Skeleton label="visible target" />}>
          <HeavyWidget label="Visible" color="#ede9fe" />
        </HydrationBoundary>
      </section>

      {/* 3. idle */}
      <section>
        <h2>3 · idle — hydrates when browser is idle</h2>
        <p>Uses <code>requestIdleCallback</code> (or <code>setTimeout(0)</code> fallback). Should hydrate shortly after page load.</p>
        <HydrationBoundary strategy="idle" fallback={<Skeleton label="idle target" />}>
          <HeavyWidget label="Idle" color="#fce7f3" />
        </HydrationBoundary>
      </section>

      {/* 4. interaction */}
      <section>
        <h2>4 · interaction — hydrates on pointer/focus</h2>
        <p>Move mouse over or tab into the boundary box. The component hydrates instantly on first pointer contact.</p>
        <HydrationBoundary strategy="interaction" fallback={<Skeleton label="hover or focus to hydrate" />}>
          <HeavyWidget label="Interaction" color="#ffedd5" />
        </HydrationBoundary>
      </section>

      {/* 5. manual */}
      <section>
        <h2>5 · manual — imperative hydrateNow()</h2>
        <p>
          The boundary stays as fallback until you press the button.
          The button lives inside the <code>fallback</code> slot and reads
          <code>hydrateNow</code> from context.
        </p>
        <HydrationBoundary
          strategy="manual"
          fallback={<ManualFallback label="manual target" />}
        >
          <HeavyWidget label="Manual" color="#cffafe" />
        </HydrationBoundary>
      </section>

      {/* 6. Nested boundaries */}
      <section>
        <h2>6 · Nested boundaries — outer idle, inner interaction</h2>
        <p>Outer boundary hydrates on idle; inner boundary (deeper in the tree) hydrates on hover. Two independent trigger chains.</p>
        <HydrationBoundary strategy="idle" fallback={<Skeleton label="outer (idle) pending" />}>
          <div style={{ border: '2px solid #a5b4fc', padding: '1rem', borderRadius: 8 }}>
            <p style={{ marginTop: 0 }}>Outer hydrated ✓</p>
            <HydrationBoundary strategy="interaction" fallback={<Skeleton label="inner (interaction) — hover me" />}>
              <HeavyWidget label="Nested inner (interaction)" color="#fef3c7" />
            </HydrationBoundary>
          </div>
        </HydrationBoundary>
      </section>

      {/* 7. No fallback */}
      <section>
        <h2>7 · No fallback prop</h2>
        <p>Boundary with no fallback — renders nothing until visible. Watch for layout shift.</p>
        <HydrationBoundary strategy="visible">
          <HeavyWidget label="No fallback" color="#f0fdf4" />
        </HydrationBoundary>
      </section>

      {/* 8. onHydrate callback */}
      <section>
        <h2>8 · onHydrate callback</h2>
        <p>Scroll the component into view. The callback fires once and records the timestamp below.</p>
        <HydrateTracker />
      </section>

    </div>
  );
}
