'use client';
import { useState } from 'react';
import { RemoteComponent, bustManifestCache } from '@bridge/share';

const HOST_MANIFEST = 'http://localhost:3001/share-manifest.json';

function RemoteDemo({
  title,
  description,
  expose,
  props,
  requiredVersion,
}: {
  title: string;
  description: string;
  expose: string;
  props?: Record<string, unknown>;
  requiredVersion?: string;
}) {
  return (
    <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.25rem 1.5rem' }}>
      <h2 style={{ fontSize: '1.05rem', color: '#3730a3', marginBottom: '0.4rem' }}>{title}</h2>
      <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '0.75rem' }}>{description}</p>
      <RemoteComponent
        manifestUrl={HOST_MANIFEST}
        expose={expose}
        requiredVersion={requiredVersion}
        props={props}
        fallback={<span style={{ color: '#64748b', fontSize: '0.85rem' }}>⏳ Loading chunk…</span>}
        errorFallback={(err) => (
          <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: '0.85rem', color: '#dc2626' }}>
            ✗ {err.message}
          </div>
        )}
      />
    </section>
  );
}

export default function ShareDemoPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  function refresh() {
    bustManifestCache(HOST_MANIFEST);
    setRefreshKey((k) => k + 1);
  }

  return (
    <main className="demo-page">
      <h1>@bridge/share — edge case tests</h1>
      <p className="subtitle">
        Components loaded at runtime from{' '}
        <code>http://localhost:3001</code> via manifest + dynamic import.
        <br />
        <strong>Requires:</strong> <code>apps/host</code> running on port 3001
        (<code>pnpm dev:host</code> from repo root).
      </p>

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button
          onClick={refresh}
          style={{ padding: '0.4rem 0.9rem', background: '#e0e7ff', color: '#3730a3', border: '1px solid #a5b4fc', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' }}
        >
          Bust cache &amp; reload
        </button>
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>key: {refreshKey}</span>
      </div>

      <div key={refreshKey} className="demos">

        <RemoteDemo
          title="1 · Basic remote component"
          description="Loads SharedButton from host-app. First load fetches manifest then chunk; subsequent renders use the TTL cache."
          expose="./Button"
          props={{ label: 'Click me (remote)' }}
        />

        <RemoteDemo
          title="2 · Custom props forwarded"
          description="Props are forwarded through RemoteComponent → useRemoteComponent → the loaded component."
          expose="./Button"
          props={{ label: 'Custom label', color: '#059669' }}
        />

        <RemoteDemo
          title="3 · Version constraint — passing (^1.0.0)"
          description="Remote exposes v1.0.0. Consumer requires ^1.0.0 — should load successfully."
          expose="./Button"
          requiredVersion="^1.0.0"
          props={{ label: 'Version OK', color: '#0891b2' }}
        />

        <RemoteDemo
          title="4 · Version constraint — failing (^2.0.0)"
          description="Remote exposes v1.0.0 but consumer requires ^2.0.0 — should show error fallback."
          expose="./Button"
          requiredVersion="^2.0.0"
          props={{ label: 'Should fail' }}
        />

        <RemoteDemo
          title="5 · Missing expose"
          description="Requests ./NonExistent which is not in the manifest — should show error fallback."
          expose="./NonExistent"
        />

      </div>
    </main>
  );
}
