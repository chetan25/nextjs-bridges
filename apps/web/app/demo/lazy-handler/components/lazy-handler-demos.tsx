'use client';
import { useState } from 'react';
import { Interactive, withLazyHandlers } from '@bridge/lazy-handler';

// --- HOC demo ---
function PlainButton({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className="demo-btn" {...rest}>{children}</button>;
}
const LazyButton = withLazyHandlers(PlainButton, {
  click: () => import('../handlers/hoc-handler'),
});

// --- Rapid-click test component ---
function RapidClickDemo() {
  const [log, setLog] = useState<string[]>([]);
  return (
    <Interactive
      on={{
        click: () =>
          import('../handlers/log-click').then((m) => ({
            default: (e: Event) => {
              m.default(e);
              setLog((prev) => [...prev, `click @ ${Date.now()}`]);
            },
          })),
      }}
    >
      <button className="demo-btn">
        Rapid-click me (handler loads once, fires every time)
      </button>
      {log.length > 0 && (
        <ul className="log">
          {log.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      )}
    </Interactive>
  );
}

export function LazyHandlerDemos() {
  return (
    <div className="demos">

      {/* 1. Basic deferred click */}
      <section>
        <h2>1 · Basic lazy click</h2>
        <p>Handler JS loads on <em>first</em> click, served from cache on all subsequent ones.</p>
        <Interactive on={{ click: () => import('../handlers/log-click') }}>
          <button className="demo-btn">Click me</button>
        </Interactive>
        <p id="lh-log" className="output" />
      </section>

      {/* 2. Slow handler (2s simulated delay) */}
      <section>
        <h2>2 · Slow handler (2 s delay)</h2>
        <p>Tests: loading state visible in the button text; double-click guard (click twice fast — only one load).</p>
        <Interactive on={{ click: () => import('../handlers/slow-handler') }}>
          <button className="demo-btn">Click (loads in 2 s)</button>
        </Interactive>
      </section>

      {/* 3. Rapid click — double-load guard */}
      <section>
        <h2>3 · Rapid clicks — double-load guard</h2>
        <p>Click many times quickly. Loader must be called exactly once.</p>
        <RapidClickDemo />
      </section>

      {/* 4. Hover preload → instant click */}
      <section>
        <h2>4 · Hover preload → instant fire</h2>
        <p>Hover over the button. The handler loads immediately. When you click, it fires with zero latency.</p>
        <Interactive
          on={{ click: () => import('../handlers/hover-preload') }}
          preloadOn="hover"
        >
          <button className="demo-btn">Hover first, then click</button>
        </Interactive>
      </section>

      {/* 5. Custom event (mouseenter) */}
      <section>
        <h2>5 · Custom event — mouseenter</h2>
        <p>Handler attached to <code>mouseenter</code> not <code>click</code>.</p>
        <Interactive on={{ mouseenter: () => import('../handlers/custom-event') }}>
          <div className="demo-box">Move mouse over this box</div>
        </Interactive>
      </section>

      {/* 6. Polymorphic as prop */}
      <section>
        <h2>6 · Polymorphic <code>as</code> prop</h2>
        <p>Default wrapper is <code>&lt;span&gt;</code>. Here we test <code>as="li"</code> inside a list — no invalid nesting.</p>
        <ul>
          <Interactive as="li" on={{ click: () => import('../handlers/log-click') }}>
            <span className="demo-link">List item with lazy click</span>
          </Interactive>
        </ul>
      </section>

      {/* 7. withLazyHandlers HOC */}
      <section>
        <h2>7 · withLazyHandlers HOC</h2>
        <p>Wraps an existing component without changing its JSX at the call site.</p>
        <LazyButton>Click (HOC)</LazyButton>
      </section>

      {/* 8. Inline context — no div breaking layout */}
      <section>
        <h2>8 · Inline text — default span wrapper</h2>
        <p>
          Normal prose with a{' '}
          <Interactive on={{ click: () => import('../handlers/log-click') }}>
            <strong style={{ cursor: 'pointer', textDecoration: 'underline' }}>
              lazy inline link
            </strong>
          </Interactive>{' '}
          inside it. No block-level div breaking the paragraph.
        </p>
      </section>

    </div>
  );
}
