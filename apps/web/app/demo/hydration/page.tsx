import { HydrationDemos } from './components/hydration-demos';

export default function HydrationDemoPage() {
  return (
    <main className="demo-page">
      <h1>@nextjs-bridges/hydration — edge case tests</h1>
      <p className="subtitle">
        Five hydration strategies. Open DevTools → Performance to verify deferred components
        don&apos;t block the initial render.
      </p>
      <HydrationDemos />
    </main>
  );
}
