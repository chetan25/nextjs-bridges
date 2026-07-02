import {
  createElement,
  createRoot
} from "./chunk-O4VRBSR5.chunk.js";

// src/components/recommendations-team/popular-products-panel.tsx
function PopularProductsPanel() {
  return createElement(
    "div",
    { style: { padding: "1rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12 } },
    createElement("h2", { style: { margin: 0, fontSize: "1.1rem" } }, "Recommendations team widget \u2014 scaffold OK")
  );
}
var mount = (container, props) => {
  const root = createRoot(container);
  root.render(createElement(PopularProductsPanel, props));
  return () => root.unmount();
};
var popular_products_panel_default = mount;
export {
  popular_products_panel_default as default
};
