export default function handleLogClick(e: Event) {
  const el = e.currentTarget as HTMLElement;
  el.dataset.count = String(Number(el.dataset.count ?? 0) + 1);
  const msg = document.getElementById('lh-log');
  if (msg) msg.textContent = `Clicked ${el.dataset.count}x — handler loaded on first click`;
}
