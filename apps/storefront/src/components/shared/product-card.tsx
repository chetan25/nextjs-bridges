import { createElement } from 'react';
import { useLazyHandler } from '@nextjs-bridges/lazy-handler/use-lazy-handler';

export interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  color?: string;
}

// Chunk-bundled component — uses createElement (not JSX). Imports
// useLazyHandler from the dedicated './use-lazy-handler' subpath, never the
// package's main entry (which also contains Interactive/withLazyHandlers and
// their react/jsx-runtime import) — see this plan's Global Constraints for why.
export function ProductCard({ id, name, price, color = '#e0e7ff' }: ProductCardProps) {
  const [addToCartRef] = useLazyHandler<HTMLButtonElement>(
    () => import('./handlers/add-to-cart'),
    { preloadOn: 'hover' },
  );
  const [quickViewRef] = useLazyHandler<HTMLButtonElement>(
    () => import('./handlers/quick-view'),
    { preloadOn: ['hover', 'idle'] },
  );

  return createElement(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        padding: '1rem',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        width: 160,
      },
    },
    createElement('div', {
      style: { height: 100, background: color, borderRadius: 6 },
    }),
    createElement('strong', null, name),
    createElement('span', { style: { color: '#475569' } }, `$${price.toFixed(2)}`),
    createElement(
      'button',
      {
        ref: addToCartRef,
        'data-id': id,
        'data-name': name,
        'data-price': String(price),
        style: {
          padding: '0.5rem',
          background: '#4f46e5',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
        },
      },
      'Add to Cart',
    ),
    createElement(
      'button',
      {
        ref: quickViewRef,
        'data-id': id,
        'data-name': name,
        'data-price': String(price),
        'data-color': color,
        style: {
          padding: '0.5rem',
          background: '#fff',
          color: '#4f46e5',
          border: '1px solid #4f46e5',
          borderRadius: 6,
          cursor: 'pointer',
        },
      },
      'Quick View',
    ),
  );
}
