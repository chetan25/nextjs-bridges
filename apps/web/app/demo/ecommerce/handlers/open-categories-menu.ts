// Loaded lazily via @bridge/lazy-handler on hover of the "Categories" nav
// item. Shell-owned (not a @bridge/share remote widget) — nav chrome is
// the shell's own concern, same reasoning as <Header>/<Footer> themselves
// not being remote components. Imperative DOM, same style as
// apps/storefront's and apps/host's handlers.
const CATEGORIES = ['Footwear', 'Bags', 'Accessories', 'Home Goods'];

let activeClose: (() => void) | null = null;

export default function openCategoriesMenu(event: Event): void {
  if (activeClose) {
    activeClose();
    activeClose = null;
  }

  const trigger = event.currentTarget as HTMLButtonElement;
  const rect = trigger.getBoundingClientRect();

  const menu = document.createElement('div');
  menu.style.cssText =
    `position:fixed;top:${rect.bottom + 6}px;left:${rect.left}px;` +
    'background:#fff;border:1px solid #e2e8f0;border-radius:8px;' +
    'box-shadow:0 4px 12px rgba(0,0,0,0.08);padding:0.5rem;min-width:160px;z-index:1000;';

  for (const category of CATEGORIES) {
    const link = document.createElement('a');
    link.href = '#';
    link.textContent = category;
    link.style.cssText =
      'display:block;padding:0.4rem 0.6rem;color:#334155;text-decoration:none;' +
      'font-size:0.9rem;border-radius:4px;';
    link.addEventListener('mouseenter', () => {
      link.style.background = '#f1f5f9';
    });
    link.addEventListener('mouseleave', () => {
      link.style.background = 'transparent';
    });
    link.addEventListener('click', (e) => e.preventDefault());
    menu.append(link);
  }

  const tag = document.createElement('div');
  tag.textContent = '[shell]';
  tag.style.cssText =
    'margin-top:0.4rem;padding-top:0.4rem;border-top:1px solid #e2e8f0;' +
    "font-family:ui-monospace,monospace;font-size:0.7rem;color:#94a3b8;text-align:right;";
  menu.append(tag);

  function close() {
    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('click', onOutsideClick);
    menu.remove();
    activeClose = null;
  }

  activeClose = close;

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  function onOutsideClick(e: MouseEvent) {
    if (!menu.contains(e.target as Node) && e.target !== trigger) close();
  }

  document.addEventListener('keydown', onKeydown);
  // Deferred one tick so the click that opened the menu (if this fired via
  // click rather than a pure hover-preload-then-click) doesn't immediately
  // close it via onOutsideClick.
  setTimeout(() => document.addEventListener('click', onOutsideClick), 0);

  document.body.append(menu);
}
