import {
  createElement,
  createRoot,
  useCallback,
  useEffect,
  useRef
} from "./chunk-O4VRBSR5.chunk.js";

// ../../packages/lazy-handler/dist/chunk-I6EIE6O6.mjs
function useLazyHandler(loader, options = {}) {
  const { event = "click", capture = false, preloadOn = "none" } = options;
  const ref = useRef(null);
  const handlerRef = useRef(null);
  const loaderRef = useRef(loader);
  const loadingRef = useRef(false);
  const cancelledRef = useRef(false);
  loaderRef.current = loader;
  const stub = useCallback((e) => {
    e.stopImmediatePropagation();
    if (handlerRef.current) {
      handlerRef.current(e);
      return;
    }
    if (loadingRef.current) return;
    loadingRef.current = true;
    const capturedCurrentTarget = e.currentTarget;
    const asyncEvent = new Proxy(e, {
      get(target, prop, receiver) {
        if (prop === "currentTarget") return capturedCurrentTarget;
        const val = Reflect.get(target, prop, receiver);
        return typeof val === "function" ? val.bind(target) : val;
      }
    });
    loaderRef.current().then((mod) => {
      if (cancelledRef.current) return;
      handlerRef.current = mod.default;
      loadingRef.current = false;
      mod.default(asyncEvent);
    }).catch(() => {
      loadingRef.current = false;
    });
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    cancelledRef.current = false;
    const doPreload = () => {
      if (!handlerRef.current && !loadingRef.current) {
        loadingRef.current = true;
        loaderRef.current().then((mod) => {
          if (!cancelledRef.current) {
            handlerRef.current = mod.default;
          }
          loadingRef.current = false;
        }).catch(() => {
          loadingRef.current = false;
        });
      }
    };
    el.addEventListener(event, stub, { capture });
    if (preloadOn === "visible") {
      if (typeof IntersectionObserver !== "undefined") {
        const obs = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              doPreload();
              obs.disconnect();
            }
          },
          { threshold: 0.1 }
        );
        obs.observe(el);
        return () => {
          cancelledRef.current = true;
          el.removeEventListener(event, stub, { capture });
          obs.disconnect();
        };
      }
    } else if (preloadOn !== "none") {
      const DOM_PRELOAD_EVENTS = {
        hover: "mouseenter",
        focus: "focusin"
      };
      const preloadEvent = DOM_PRELOAD_EVENTS[preloadOn] ?? preloadOn;
      el.addEventListener(preloadEvent, doPreload, { once: true });
      return () => {
        cancelledRef.current = true;
        el.removeEventListener(event, stub, { capture });
        el.removeEventListener(preloadEvent, doPreload);
      };
    }
    return () => {
      cancelledRef.current = true;
      el.removeEventListener(event, stub, { capture });
    };
  }, [event, capture, preloadOn, stub]);
  return [ref, stub];
}

// src/components/shared/product-card.tsx
function ProductCard({ id, name, price, color = "#e0e7ff" }) {
  const [ref] = useLazyHandler(
    () => import("./add-to-cart-VGLPFE4L.chunk.js"),
    { preloadOn: "hover" }
  );
  return createElement(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        padding: "1rem",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        width: 160
      }
    },
    createElement("div", {
      style: { height: 100, background: color, borderRadius: 6 }
    }),
    createElement("strong", null, name),
    createElement("span", { style: { color: "#475569" } }, `$${price.toFixed(2)}`),
    createElement(
      "button",
      {
        ref,
        "data-id": id,
        "data-name": name,
        "data-price": String(price),
        style: {
          padding: "0.5rem",
          background: "#4f46e5",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer"
        }
      },
      "Add to Cart"
    )
  );
}

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
