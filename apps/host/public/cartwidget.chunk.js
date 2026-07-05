import {
  createElement,
  createRoot,
  useCallback,
  useEffect,
  useRef,
  useState
} from "./chunk-3ZDPZGXF.chunk.js";

// ../../packages/lazy-handler/dist/chunk-KZ3MSAEG.mjs
var DOM_PRELOAD_EVENTS = {
  hover: "mouseenter",
  focus: "focusin"
};
function useLazyHandler(loader, options = {}) {
  const { event = "click", capture = false, preloadOn = "none" } = options;
  const strategies = Array.isArray(preloadOn) ? preloadOn : [preloadOn];
  const strategiesKey = strategies.join(",");
  const [node, setNode] = useState(null);
  const ref = useCallback((el) => setNode(el), []);
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
    const el = node;
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
    const teardowns = [];
    for (const strategy of strategies) {
      if (strategy === "none") continue;
      if (strategy === "visible") {
        if (typeof IntersectionObserver === "undefined") continue;
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
        teardowns.push(() => obs.disconnect());
        continue;
      }
      if (strategy === "idle") {
        let id;
        if ("requestIdleCallback" in window) {
          id = requestIdleCallback(doPreload);
          teardowns.push(() => cancelIdleCallback(id));
        } else {
          id = setTimeout(doPreload, 0);
          teardowns.push(() => clearTimeout(id));
        }
        continue;
      }
      const preloadEvent = DOM_PRELOAD_EVENTS[strategy] ?? strategy;
      el.addEventListener(preloadEvent, doPreload, { once: true });
      teardowns.push(() => el.removeEventListener(preloadEvent, doPreload));
    }
    return () => {
      cancelledRef.current = true;
      el.removeEventListener(event, stub, { capture });
      teardowns.forEach((fn) => fn());
    };
  }, [node, event, capture, strategiesKey, stub]);
  return [ref, stub];
}

// src/components/checkout-team/cart-widget.tsx
function CartWidget() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function onAdd(e) {
      const { detail } = e;
      setItems((prev) => [...prev, detail]);
    }
    window.addEventListener("bridge:cart:add", onAdd);
    return () => window.removeEventListener("bridge:cart:add", onAdd);
  }, []);
  const [checkoutRef] = useLazyHandler(
    () => import("./start-checkout-LZACR7TF.chunk.js"),
    { preloadOn: "hover" }
  );
  const total = items.reduce((sum, item) => sum + item.price, 0);
  return createElement(
    "div",
    { style: { position: "relative", fontFamily: "inherit" } },
    createElement(
      "button",
      {
        onClick: () => setOpen((o) => !o),
        style: {
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.5rem 0.75rem",
          background: "#fff",
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          cursor: "pointer"
        }
      },
      "\u{1F6D2}",
      createElement(
        "span",
        {
          style: {
            background: "#4f46e5",
            color: "#fff",
            borderRadius: 999,
            fontSize: "0.75rem",
            padding: "0.1rem 0.45rem"
          }
        },
        String(items.length)
      )
    ),
    open && createElement(
      "div",
      {
        style: {
          position: "absolute",
          top: "100%",
          right: 0,
          marginTop: "0.4rem",
          width: 220,
          padding: "0.75rem",
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
        }
      },
      createElement(
        "span",
        {
          style: {
            display: "inline-block",
            fontFamily: "ui-monospace, monospace",
            fontSize: "0.7rem",
            color: "#4338ca",
            background: "#eef2ff",
            border: "1px solid #c7d2fe",
            borderRadius: 4,
            padding: "0.1rem 0.4rem",
            marginBottom: "0.5rem"
          }
        },
        "[remote \xB7 host]"
      ),
      items.length === 0 ? createElement(
        "p",
        { style: { margin: 0, color: "#64748b", fontSize: "0.85rem" } },
        "Cart is empty"
      ) : createElement(
        "ul",
        {
          style: {
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.3rem"
          }
        },
        ...items.map(
          (item, i) => createElement(
            "li",
            {
              key: `${item.id}-${i}`,
              style: { display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }
            },
            createElement("span", null, item.name),
            createElement("span", null, `$${item.price.toFixed(2)}`)
          )
        )
      ),
      items.length > 0 && createElement(
        "button",
        {
          ref: checkoutRef,
          style: {
            marginTop: "0.6rem",
            width: "100%",
            padding: "0.5rem",
            background: "#16a34a",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer"
          }
        },
        `Proceed to Checkout ($${total.toFixed(2)})`
      )
    )
  );
}
var mount = (container, props) => {
  const root = createRoot(container);
  root.render(createElement(CartWidget, props));
  return () => root.unmount();
};
var cart_widget_default = mount;
export {
  cart_widget_default as default
};
