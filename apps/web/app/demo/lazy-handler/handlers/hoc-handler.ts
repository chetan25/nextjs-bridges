export default function handleHocButton(e: Event) {
  const btn = e.currentTarget as HTMLButtonElement;
  btn.textContent = '✓ HOC handler loaded & fired';
  btn.style.background = '#fef9c3';
}
