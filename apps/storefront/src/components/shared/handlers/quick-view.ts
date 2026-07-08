// Loaded lazily via @nextjs-bridges/lazy-handler when the user hovers "Quick View"
// or the browser goes idle, whichever happens first (see ProductCard's
// preloadOn: ['hover', 'idle']). Renders an imperative modal — no React
// state — same style as ./add-to-cart.ts and apps/host's
// ./handlers/start-checkout.ts.
//
// Dispatches the same 'bridge:cart:add' contract as ./add-to-cart.ts,
// duplicated inline rather than imported — see
// docs/superpowers/specs/2026-07-02-ecommerce-example-design.md,
// "Cross-widget cart sync", for why independently-loaded handler modules
// duplicate this tiny contract instead of sharing an import.
export default function openQuickView(event: Event): void {
  const button = event.currentTarget as HTMLButtonElement;
  const { id, name, price, color } = button.dataset;
  if (!id || !name || !price) return;
  const numericPrice = Number(price);

  const backdrop = document.createElement('div');
  backdrop.style.cssText =
    'position:fixed;inset:0;background:rgba(15,23,42,0.5);display:flex;' +
    'align-items:center;justify-content:center;z-index:1000;';

  const panel = document.createElement('div');
  panel.style.cssText =
    'background:#fff;border-radius:12px;padding:1.5rem;width:min(90vw,420px);' +
    'position:relative;box-shadow:0 20px 40px rgba(0,0,0,0.2);';

  function close() {
    document.removeEventListener('keydown', onKeydown);
    backdrop.remove();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', onKeydown);

  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.style.cssText =
    'position:absolute;top:0.75rem;right:0.75rem;border:none;background:transparent;' +
    'font-size:1.5rem;line-height:1;cursor:pointer;color:#64748b;';
  closeButton.addEventListener('click', close);

  const image = document.createElement('div');
  image.style.cssText = `height:200px;border-radius:8px;background:${color ?? '#e0e7ff'};margin-bottom:1rem;`;

  const tag = document.createElement('span');
  tag.textContent = '[remote · storefront]';
  tag.style.cssText =
    'display:inline-block;font-family:ui-monospace,monospace;font-size:0.7rem;' +
    'color:#4338ca;background:#eef2ff;border:1px solid #c7d2fe;border-radius:4px;' +
    'padding:0.1rem 0.4rem;margin-bottom:0.5rem;';

  const heading = document.createElement('h3');
  heading.textContent = name;
  heading.style.cssText = 'margin:0 0 0.4rem;';

  const priceEl = document.createElement('p');
  priceEl.textContent = `$${numericPrice.toFixed(2)}`;
  priceEl.style.cssText = 'margin:0 0 0.75rem;color:#475569;font-weight:600;';

  const description = document.createElement('p');
  description.textContent = 'A closer look at this item — imagine a full product description here.';
  description.style.cssText = 'margin:0 0 1.25rem;color:#64748b;font-size:0.9rem;';

  const addToCartButton = document.createElement('button');
  addToCartButton.textContent = 'Add to Cart';
  addToCartButton.style.cssText =
    'width:100%;padding:0.6rem;background:#4f46e5;color:#fff;border:none;' +
    'border-radius:6px;cursor:pointer;font-size:0.95rem;';
  addToCartButton.addEventListener('click', () => {
    window.dispatchEvent(
      new CustomEvent('bridge:cart:add', {
        detail: { id, name, price: numericPrice },
      }),
    );
    addToCartButton.textContent = 'Added ✓';
    addToCartButton.disabled = true;
    setTimeout(close, 600);
  });

  panel.append(closeButton, tag, image, heading, priceEl, description, addToCartButton);
  backdrop.append(panel);
  document.body.append(backdrop);
}
