const reactDom = (globalThis as { __bridgeShared?: Record<string, any> }).__bridgeShared?.['react-dom'];
if (!reactDom) {
  throw new Error(
    '@nextjs-bridges/share: window.__bridgeShared["react-dom"] was not available when this chunk loaded. ' +
      'Make sure <BridgeSharedDepsProvider> wraps the page before any remote component mounts.',
  );
}

export default reactDom;
export const { createPortal, flushSync, version } = reactDom;
