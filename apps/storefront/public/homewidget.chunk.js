import {
  createElement,
  createRoot
} from "./chunk-QKQMZQ5L.chunk.js";

// src/components/home-team/home-widget.tsx
function HomeWidget() {
  return createElement(
    "div",
    { style: { padding: "2rem", background: "#eef2ff", borderRadius: 12 } },
    createElement("h1", { style: { margin: 0 } }, "Home team widget \u2014 scaffold OK")
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
