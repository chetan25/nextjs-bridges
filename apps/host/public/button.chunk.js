import {
  createElement,
  createRoot
} from "./chunk-NXXJ244C.chunk.js";

// src/components/button.tsx
function SharedButton({ label = "Remote Button", color = "#6366f1" }) {
  return createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "0.75rem", alignItems: "flex-start" } },
    createElement(
      "div",
      {
        style: {
          padding: "0.6rem 1rem",
          background: "#f0fdf4",
          border: "2px solid #86efac",
          borderRadius: 8,
          fontSize: "0.85rem",
          color: "#15803d",
          fontWeight: 600
        }
      },
      "\u2713 Loaded from host-app \u2014 dynamically imported chunk"
    ),
    createElement(
      "button",
      {
        style: {
          padding: "0.5rem 1.25rem",
          background: color,
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: "1rem",
          fontFamily: "inherit"
        },
        onClick(e) {
          const btn = e.currentTarget;
          const n = Number(btn.dataset.n ?? "0") + 1;
          btn.dataset.n = String(n);
          btn.textContent = n === 1 ? `${label} \u2014 clicked!` : `${label} \xD7${n}`;
        }
      },
      label
    )
  );
}
var mount = (container, props) => {
  const root = createRoot(container);
  root.render(createElement(SharedButton, props));
  return () => root.unmount();
};
var button_default = mount;
export {
  button_default as default
};
