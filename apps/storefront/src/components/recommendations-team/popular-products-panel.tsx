import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

type MountFunction = (
  container: HTMLElement,
  props: Record<string, unknown>,
) => () => void;

function PopularProductsPanel() {
  return createElement(
    'div',
    { style: { padding: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12 } },
    createElement('h2', { style: { margin: 0, fontSize: '1.1rem' } }, 'Recommendations team widget — scaffold OK'),
  );
}

const mount: MountFunction = (container, props) => {
  const root = createRoot(container);
  root.render(createElement(PopularProductsPanel, props));
  return () => root.unmount();
};

export default mount;
