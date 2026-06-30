// Simulates a 2-second network delay before the handler is ready.
// Tests: loading state, double-click guard, cancelled-on-unmount.
async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default async function handleSlow(e: Event) {
  const btn = e.currentTarget as HTMLButtonElement;
  btn.textContent = 'Loading handler… (2s)';
  await sleep(2000);
  btn.textContent = '✓ Slow handler fired!';
}
