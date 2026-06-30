export default function handleMouseEnter(e: Event) {
  const el = e.currentTarget as HTMLElement;
  el.style.background = '#d1fae5';
  el.textContent = '✓ mouseenter handler loaded & fired (not a click!)';
}
