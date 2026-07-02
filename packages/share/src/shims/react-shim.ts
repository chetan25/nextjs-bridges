// Re-exports the shell's already-loaded React instance instead of bundling a
// second copy. Only reached when apps/host/tsup.config.ts's dynamic external/
// alias wiring (Task 10) has determined this React version is compatible
// with what apps/web guarantees — see shared-dep-resolver.ts.
const react = (globalThis as { __bridgeShared?: Record<string, any> }).__bridgeShared?.react;
if (!react) {
  throw new Error(
    '@bridge/share: window.__bridgeShared.react was not available when this chunk loaded. ' +
      'Make sure <BridgeSharedDepsProvider> wraps the page before any remote component mounts.',
  );
}

export default react;
export const {
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
  version,
} = react;
