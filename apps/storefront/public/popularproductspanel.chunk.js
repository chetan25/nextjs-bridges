import {
  ProductCard,
  createElement,
  createRoot
} from "./chunk-NDIGJQRL.chunk.js";

// src/components/recommendations-team/popular-products-panel.tsx
var DEFAULT_PRODUCTS = [
  { id: "r1", name: "Insulated Bottle", price: 22, color: "#c7d2fe" },
  { id: "r2", name: "Desk Plant", price: 12.99, color: "#a7f3d0" },
  { id: "r3", name: "Notebook Set", price: 9.5, color: "#fbcfe8" }
];
function PopularProductsPanel({ products = DEFAULT_PRODUCTS }) {
  return createElement(
    "section",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        padding: "1rem",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        background: "#f8fafc"
      }
    },
    createElement("h2", { style: { margin: 0, fontSize: "1.1rem" } }, "\u{1F525} Popular Right Now"),
    createElement(
      "p",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          margin: 0,
          fontSize: "0.8rem",
          color: "#64748b"
        }
      },
      createElement(
        "span",
        {
          style: {
            fontFamily: "ui-monospace, monospace",
            fontSize: "0.7rem",
            color: "#4338ca",
            background: "#eef2ff",
            border: "1px solid #c7d2fe",
            borderRadius: 4,
            padding: "0.1rem 0.4rem"
          }
        },
        "[remote \xB7 storefront]"
      ),
      "Owned by the Recommendations team"
    ),
    createElement(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "0.75rem" } },
      ...products.map((p) => createElement(ProductCard, { key: p.id, ...p }))
    )
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
