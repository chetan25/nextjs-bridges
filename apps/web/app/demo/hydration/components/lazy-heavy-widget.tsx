'use client';
import { useState } from 'react';

interface LazyHeavyWidgetProps {
  label: string;
  color?: string;
}

// Only ever referenced via HydrationBoundary's loader prop (dynamic import) in
// hydration-demos.tsx — never statically imported — so the bundler gives it its
// own chunk, genuinely proving deferred code-splitting (not just deferred hydration).
export default function LazyHeavyWidget({ label, color = '#eff6ff' }: LazyHeavyWidgetProps) {
  const [count, setCount] = useState(0);
  return (
    <div style={{ background: color, border: '2px solid #93c5fd', padding: '1rem', borderRadius: 8 }}>
      <strong>{label}</strong>
      <p>✓ Hydrated! Count: {count}</p>
      <button onClick={() => setCount((c) => c + 1)}>Increment</button>
    </div>
  );
}
