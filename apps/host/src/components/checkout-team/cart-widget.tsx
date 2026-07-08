import { createElement, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useLazyHandler } from '@nextjs-bridges/lazy-handler/use-lazy-handler';

interface CartItem {
  id: string;
  name: string;
  price: number;
}

// Payload shape agreed by convention with apps/storefront's add-to-cart
// handler (apps/storefront/src/components/shared/handlers/add-to-cart.ts) —
// duplicated rather than imported from a shared package, since two
// independently-deployed teams coordinate on an event name + shape, not a
// compiler-checked type. See
// docs/superpowers/specs/2026-07-02-ecommerce-example-design.md.
interface CartAddEventDetail {
  id: string;
  name: string;
  price: number;
}

type MountFunction = (
  container: HTMLElement,
  props: Record<string, unknown>,
) => () => void;

function CartWidget() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onAdd(e: Event) {
      const { detail } = e as CustomEvent<CartAddEventDetail>;
      setItems((prev) => [...prev, detail]);
    }
    window.addEventListener('bridge:cart:add', onAdd);
    return () => window.removeEventListener('bridge:cart:add', onAdd);
  }, []);

  const [checkoutRef] = useLazyHandler<HTMLButtonElement>(
    () => import('./handlers/start-checkout'),
    { preloadOn: 'hover' },
  );

  const total = items.reduce((sum, item) => sum + item.price, 0);

  return createElement(
    'div',
    { style: { position: 'relative', fontFamily: 'inherit' } },
    createElement(
      'button',
      {
        onClick: () => setOpen((o) => !o),
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.5rem 0.75rem',
          background: '#fff',
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          cursor: 'pointer',
        },
      },
      '🛒',
      createElement(
        'span',
        {
          style: {
            background: '#4f46e5',
            color: '#fff',
            borderRadius: 999,
            fontSize: '0.75rem',
            padding: '0.1rem 0.45rem',
          },
        },
        String(items.length),
      ),
    ),
    open &&
      createElement(
        'div',
        {
          style: {
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '0.4rem',
            width: 220,
            padding: '0.75rem',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          },
        },
        createElement(
          'span',
          {
            style: {
              display: 'inline-block',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.7rem',
              color: '#4338ca',
              background: '#eef2ff',
              border: '1px solid #c7d2fe',
              borderRadius: 4,
              padding: '0.1rem 0.4rem',
              marginBottom: '0.5rem',
            },
          },
          '[remote · host]',
        ),
        items.length === 0
          ? createElement(
              'p',
              { style: { margin: 0, color: '#64748b', fontSize: '0.85rem' } },
              'Cart is empty',
            )
          : createElement(
              'ul',
              {
                style: {
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem',
                },
              },
              ...items.map((item, i) =>
                createElement(
                  'li',
                  {
                    key: `${item.id}-${i}`,
                    style: { display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' },
                  },
                  createElement('span', null, item.name),
                  createElement('span', null, `$${item.price.toFixed(2)}`),
                ),
              ),
            ),
        items.length > 0 &&
          createElement(
            'button',
            {
              ref: checkoutRef,
              style: {
                marginTop: '0.6rem',
                width: '100%',
                padding: '0.5rem',
                background: '#16a34a',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              },
            },
            `Proceed to Checkout ($${total.toFixed(2)})`,
          ),
      ),
  );
}

const mount: MountFunction = (container, props) => {
  const root = createRoot(container);
  root.render(createElement(CartWidget, props));
  return () => root.unmount();
};

export default mount;
