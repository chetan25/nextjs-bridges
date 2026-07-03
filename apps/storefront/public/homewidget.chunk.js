import {
  ProductCard,
  createElement,
  createRoot
} from "./chunk-L6S6U2P2.chunk.js";

// src/components/home-team/home-widget.tsx
var DEFAULT_PRODUCTS = [
  { id: "p1", name: "Trail Sneakers", price: 79.99, color: "#fecaca" },
  { id: "p2", name: "Canvas Tote", price: 24.5, color: "#bbf7d0" },
  { id: "p3", name: "Wool Beanie", price: 18, color: "#bfdbfe" },
  { id: "p4", name: "Ceramic Mug", price: 14.25, color: "#fde68a" }
];
function HomeWidget({ products = DEFAULT_PRODUCTS }) {
  return createElement(
    "section",
    { style: { display: "flex", flexDirection: "column", gap: "1rem" } },
    createElement(
      "div",
      {
        style: {
          padding: "2rem",
          background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
          color: "#fff",
          borderRadius: 12
        }
      },
      createElement("h1", { style: { margin: 0 } }, "Summer Essentials"),
      createElement(
        "p",
        { style: { margin: "0.5rem 0 0" } },
        "Owned by the Home team \u2014 loaded from apps/storefront"
      )
    ),
    createElement(
      "div",
      { style: { display: "flex", gap: "1rem", flexWrap: "wrap" } },
      ...products.map((p) => createElement(ProductCard, { key: p.id, ...p }))
    )
  );
}
var mount = (container, props) => {
  const root = createRoot(container);
  root.render(createElement(HomeWidget, props));
  return () => root.unmount();
};
var home_widget_default = mount;
export {
  home_widget_default as default
};
