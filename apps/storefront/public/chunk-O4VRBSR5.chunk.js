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

export {
  createElement,
  useCallback,
  useEffect,
  useRef,
  createRoot
};
