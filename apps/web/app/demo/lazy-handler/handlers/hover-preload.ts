export default function handleAfterHoverPreload(e: Event) {
  const el = e.currentTarget as HTMLElement;
  el.textContent = '✓ Fired instantly — handler was preloaded on hover!';
}
