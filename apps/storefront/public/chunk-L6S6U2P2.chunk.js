// ../../packages/share/src/shims/react-shim.ts
var react = globalThis.__bridgeShared?.react;
if (!react) {
  throw new Error(
    "@bridge/share: window.__bridgeShared.react was not available when this chunk loaded. Make sure <BridgeSharedDepsProvider> wraps the page before any remote component mounts."
  );
}
var {
  Children,
  Component,
  Fragment,
  Profiler,
  PureComponent,
  StrictMode,
  Suspense,
  cloneElement,
  createContext,
  createElement,
  createRef,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  startTransition,
  useCallback,
  useContext,
  useDebugValue,
  useDeferredValue,
  useEffect,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  version
} = react;

// ../../packages/share/src/shims/react-dom-client-shim.ts
var reactDomClient = globalThis.__bridgeShared?.["react-dom/client"];
if (!reactDomClient) {
  throw new Error(
    '@bridge/share: window.__bridgeShared["react-dom/client"] was not available when this chunk loaded. Make sure <BridgeSharedDepsProvider> wraps the page before any remote component mounts.'
  );
}
var { createRoot, hydrateRoot } = reactDomClient;

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

// src/components/shared/product-card.tsx
function ProductCard({ id, name, price, color = "#e0e7ff" }) {
  const [addToCartRef] = useLazyHandler(
    () => import("./add-to-cart-VGLPFE4L.chunk.js"),
    { preloadOn: "hover" }
  );
  const [quickViewRef] = useLazyHandler(
    () => import("./quick-view-GGANXEVO.chunk.js"),
    { preloadOn: ["hover", "idle"] }
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
        ref: addToCartRef,
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
    ),
    createElement(
      "button",
      {
        ref: quickViewRef,
        "data-id": id,
        "data-name": name,
        "data-price": String(price),
        "data-color": color,
        style: {
          padding: "0.5rem",
          background: "#fff",
          color: "#4f46e5",
          border: "1px solid #4f46e5",
          borderRadius: 6,
          cursor: "pointer"
        }
      },
      "Quick View"
    )
  );
}

export {
  createElement,
  createRoot,
  ProductCard
};
