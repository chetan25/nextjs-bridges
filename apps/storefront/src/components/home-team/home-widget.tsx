import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

type MountFunction = (
  container: HTMLElement,
  props: Record<string, unknown>,
) => () => void;

function HomeWidget() {
  return createElement(
    'div',
    { style: { padding: '2rem', background: '#eef2ff', borderRadius: 12 } },
    createElement('h1', { style: { margin: 0 } }, 'Home team widget — scaffold OK'),
  );
}

const mount: MountFunction = (container, props) => {
  const root = createRoot(container);
  root.render(createElement(HomeWidget, props));
  return () => root.unmount();
};

export default mount;
