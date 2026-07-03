// src/components/checkout-team/handlers/start-checkout.ts
function startCheckout(event) {
  const button = event.currentTarget;
  button.textContent = "\u2713 Checkout started";
  button.disabled = true;
  button.style.background = "#94a3b8";
  button.style.cursor = "default";
}
export {
  startCheckout as default
};
