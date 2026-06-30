'use client';
import { useState } from 'react';

interface HeavyWidgetProps {
  label: string;
  color?: string;
}

// Simulates a "heavy" Client Component with local state and interactions
export function HeavyWidget({ label, color = '#eff6ff' }: HeavyWidgetProps) {
  const [count, setCount] = useState(0);
  return (
    <div style={{ background: color, border: '2px solid #93c5fd', padding: '1rem', borderRadius: 8 }}>
      <strong>{label}</strong>
      <p>✓ Hydrated! Count: {count}</p>
      <button onClick={() => setCount((c) => c + 1)}>Increment</button>
    </div>
  );
}
