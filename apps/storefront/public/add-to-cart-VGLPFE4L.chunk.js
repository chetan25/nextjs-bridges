// src/components/shared/handlers/add-to-cart.ts
function addToCart(event) {
  const button = event.currentTarget;
  const { id, name, price } = button.dataset;
  if (!id || !name || !price) return;
  window.dispatchEvent(
    new CustomEvent("bridge:cart:add", {
      detail: { id, name, price: Number(price) }
    })
  );
  button.textContent = "Added \u2713";
  button.disabled = true;
  setTimeout(() => {
    button.textContent = "Add to Cart";
    button.disabled = false;
  }, 1200);
}
export {
  addToCart as default
};
