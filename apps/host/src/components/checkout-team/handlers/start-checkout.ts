// Loaded lazily via @bridge/lazy-handler when the user hovers or clicks
// "Proceed to Checkout" in CartWidget. Simulates kicking off a real checkout
// flow module — this demo only updates the button to show it fired.
export default function startCheckout(event: Event): void {
  const button = event.currentTarget as HTMLButtonElement;
  button.textContent = '✓ Checkout started';
  button.disabled = true;
  button.style.background = '#94a3b8';
  button.style.cursor = 'default';
}
