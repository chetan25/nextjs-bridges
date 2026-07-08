// Loaded lazily via @nextjs-bridges/lazy-handler on first "Add to Cart" click.
// Publishes to window so apps/host's CartWidget (a separate React root,
// a separate app) can react — see
// apps/host/src/components/checkout-team/cart-widget.tsx, which listens
// for this same event name and payload shape by convention, not by import.
export interface CartAddEventDetail {
  id: string;
  name: string;
  price: number;
}

export default function addToCart(event: Event): void {
  const button = event.currentTarget as HTMLButtonElement;
  const { id, name, price } = button.dataset;
  if (!id || !name || !price) return;

  window.dispatchEvent(
    new CustomEvent<CartAddEventDetail>('bridge:cart:add', {
      detail: { id, name, price: Number(price) },
    }),
  );

  button.textContent = 'Added ✓';
  button.disabled = true;
  setTimeout(() => {
    button.textContent = 'Add to Cart';
    button.disabled = false;
  }, 1200);
}
