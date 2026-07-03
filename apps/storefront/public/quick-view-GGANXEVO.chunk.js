// src/components/shared/handlers/quick-view.ts
function openQuickView(event) {
  const button = event.currentTarget;
  const { id, name, price, color } = button.dataset;
  if (!id || !name || !price) return;
  const numericPrice = Number(price);
  const backdrop = document.createElement("div");
  backdrop.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;";
  const panel = document.createElement("div");
  panel.style.cssText = "background:#fff;border-radius:12px;padding:1.5rem;width:min(90vw,420px);position:relative;box-shadow:0 20px 40px rgba(0,0,0,0.2);";
  function close() {
    document.removeEventListener("keydown", onKeydown);
    backdrop.remove();
  }
  function onKeydown(e) {
    if (e.key === "Escape") close();
  }
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener("keydown", onKeydown);
  const closeButton = document.createElement("button");
  closeButton.textContent = "\xD7";
  closeButton.setAttribute("aria-label", "Close");
  closeButton.style.cssText = "position:absolute;top:0.75rem;right:0.75rem;border:none;background:transparent;font-size:1.5rem;line-height:1;cursor:pointer;color:#64748b;";
  closeButton.addEventListener("click", close);
  const image = document.createElement("div");
  image.style.cssText = `height:200px;border-radius:8px;background:${color ?? "#e0e7ff"};margin-bottom:1rem;`;
  const heading = document.createElement("h3");
  heading.textContent = name;
  heading.style.cssText = "margin:0 0 0.4rem;";
  const priceEl = document.createElement("p");
  priceEl.textContent = `$${numericPrice.toFixed(2)}`;
  priceEl.style.cssText = "margin:0 0 0.75rem;color:#475569;font-weight:600;";
  const description = document.createElement("p");
  description.textContent = "A closer look at this item \u2014 imagine a full product description here.";
  description.style.cssText = "margin:0 0 1.25rem;color:#64748b;font-size:0.9rem;";
  const addToCartButton = document.createElement("button");
  addToCartButton.textContent = "Add to Cart";
  addToCartButton.style.cssText = "width:100%;padding:0.6rem;background:#4f46e5;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.95rem;";
  addToCartButton.addEventListener("click", () => {
    window.dispatchEvent(
      new CustomEvent("bridge:cart:add", {
        detail: { id, name, price: numericPrice }
      })
    );
    addToCartButton.textContent = "Added \u2713";
    addToCartButton.disabled = true;
    setTimeout(close, 600);
  });
  panel.append(closeButton, image, heading, priceEl, description, addToCartButton);
  backdrop.append(panel);
  document.body.append(backdrop);
}
export {
  openQuickView as default
};
