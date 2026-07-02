import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { ProductCard, type ProductCardProps } from '../shared/product-card';

interface Props {
  products?: ProductCardProps[];
}

const DEFAULT_PRODUCTS: ProductCardProps[] = [
  { id: 'r1', name: 'Insulated Bottle', price: 22.0, color: '#c7d2fe' },
  { id: 'r2', name: 'Desk Plant', price: 12.99, color: '#a7f3d0' },
  { id: 'r3', name: 'Notebook Set', price: 9.5, color: '#fbcfe8' },
];

type MountFunction = (
  container: HTMLElement,
  props: Record<string, unknown>,
) => () => void;

function PopularProductsPanel({ products = DEFAULT_PRODUCTS }: Props) {
  return createElement(
    'section',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        padding: '1rem',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        background: '#f8fafc',
      },
    },
    createElement('h2', { style: { margin: 0, fontSize: '1.1rem' } }, '🔥 Popular Right Now'),
    createElement(
      'p',
      { style: { margin: 0, fontSize: '0.8rem', color: '#64748b' } },
      'Owned by the Recommendations team — loaded from apps/storefront',
    ),
    createElement(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '0.75rem' } },
      ...products.map((p) => createElement(ProductCard, { key: p.id, ...p })),
    ),
  );
}

const mount: MountFunction = (container, props) => {
  const root = createRoot(container);
  root.render(createElement(PopularProductsPanel, props as Props));
  return () => root.unmount();
};

export default mount;
