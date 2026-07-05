import { LazyHandlerDemos } from './components/lazy-handler-demos';

export default function LazyHandlerDemoPage() {
  return (
    <main className="demo-page">
      <h1>@chetand/lazy-handler — edge case tests</h1>
      <p className="subtitle">
        Handler JS is deferred until first interaction. Open DevTools → Network to watch chunks load on demand.
      </p>
      <LazyHandlerDemos />
    </main>
  );
}
