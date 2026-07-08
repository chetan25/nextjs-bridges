// Separate from react-dom-shim.ts because createRoot/hydrateRoot live under
// the 'react-dom/client' subpath, not the top-level 'react-dom' export —
// button.tsx (and any exposed component using the imperative mount pattern)
// imports createRoot from 'react-dom/client' specifically.
const reactDomClient = (globalThis as { __bridgeShared?: Record<string, any> }).__bridgeShared?.[
  'react-dom/client'
];
if (!reactDomClient) {
  throw new Error(
    '@nextjs-bridges/share: window.__bridgeShared["react-dom/client"] was not available when this chunk loaded. ' +
      'Make sure <BridgeSharedDepsProvider> wraps the page before any remote component mounts.',
  );
}

export default reactDomClient;
export const { createRoot, hydrateRoot } = reactDomClient;
