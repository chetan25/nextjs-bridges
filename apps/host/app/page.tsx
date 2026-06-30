export default function HostHomePage() {
  return (
    <main>
      <h1>@bridge/share host</h1>
      <p>
        This app exposes shared components via <code>/share-manifest.json</code>.
      </p>
      <p>
        TODO Phase 3: configure <code>next.config.ts</code> with{' '}
        <code>shareConfig</code> and add exposed components.
      </p>
    </main>
  );
}
