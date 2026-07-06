import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { format } from 'date-fns';

interface Props {
  label?: string;
  color?: string;
}

// Imperative mount pattern — the chunk manages its own React root so the
// consumer never receives React elements created by a different React instance.
type MountFunction = (
  container: HTMLElement,
  props: Record<string, unknown>,
) => () => void;

function SharedButton({ label = 'Remote Button', color = '#6366f1' }: Props) {
  return createElement(
    'div',
    { style: { display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-start' } },
    createElement(
      'div',
      {
        style: {
          padding: '0.6rem 1rem',
          background: '#f0fdf4',
          border: '2px solid #86efac',
          borderRadius: 8,
          fontSize: '0.85rem',
          color: '#15803d',
          fontWeight: 600,
        },
      },
      `✓ Loaded from host-app — dynamically imported chunk (rendered ${format(new Date(), 'PPpp')})`,
    ),
    createElement(
      'button',
      {
        style: {
          padding: '0.5rem 1.25rem',
          background: color,
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: '1rem',
          fontFamily: 'inherit',
        },
        onClick(e: MouseEvent) {
          const btn = e.currentTarget as HTMLButtonElement;
          const n = Number(btn.dataset.n ?? '0') + 1;
          btn.dataset.n = String(n);
          btn.textContent =
            n === 1 ? `${label} — clicked!` : `${label} ×${n}`;
        },
      },
      label,
    ),
  );
}

const mount: MountFunction = (container, props) => {
  const root = createRoot(container);
  root.render(createElement(SharedButton, props as Props));
  return () => root.unmount();
};

export default mount;
