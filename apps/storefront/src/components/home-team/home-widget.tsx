import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { ProductCard, type ProductCardProps } from '../shared/product-card';

interface Props {
  products?: ProductCardProps[];
}

const DEFAULT_PRODUCTS: ProductCardProps[] = [
  { id: 'p1', name: 'Trail Sneakers', price: 79.99, color: '#fecaca' },
  { id: 'p2', name: 'Canvas Tote', price: 24.5, color: '#bbf7d0' },
  { id: 'p3', name: 'Wool Beanie', price: 18.0, color: '#bfdbfe' },
  { id: 'p4', name: 'Ceramic Mug', price: 14.25, color: '#fde68a' },
];

type MountFunction = (
  container: HTMLElement,
  props: Record<string, unknown>,
) => () => void;

function HomeWidget({ products = DEFAULT_PRODUCTS }: Props) {
  return createElement(
    'section',
    { style: { display: 'flex', flexDirection: 'column', gap: '1rem' } },
    createElement(
      'div',
      {
        style: {
          padding: '2rem',
          background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
          color: '#fff',
          borderRadius: 12,
        },
      },
      createElement('h1', { style: { margin: 0 } }, 'Summer Essentials'),
      createElement(
        'p',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            margin: '0.5rem 0 0',
          },
        },
        createElement(
          'span',
          {
            style: {
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.7rem',
              color: '#fff',
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: 4,
              padding: '0.1rem 0.4rem',
            },
          },
          '[remote · storefront]',
        ),
        'Owned by the Home team',
      ),
    ),
    createElement(
      'div',
      { style: { display: 'flex', gap: '1rem', flexWrap: 'wrap' } },
      ...products.map((p) => createElement(ProductCard, { key: p.id, ...p })),
    ),
  );
}

const mount: MountFunction = (container, props) => {
  const root = createRoot(container);
  root.render(createElement(HomeWidget, props as Props));
  return () => root.unmount();
};

export default mount;
