const SHELL_TAG_STYLE = {
  fontFamily: 'ui-monospace, monospace',
  fontSize: '0.7rem',
  color: '#334155',
  background: '#f1f5f9',
  border: '1px solid #e2e8f0',
  borderRadius: 4,
  padding: '0.1rem 0.4rem',
} as const;

export function Footer() {
  return (
    <footer
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '1.5rem',
        marginTop: '2rem',
        borderTop: '1px solid #e2e8f0',
        fontSize: '0.85rem',
        color: '#64748b',
      }}
    >
      <span style={SHELL_TAG_STYLE}>[shell]</span>
      No bridges here — just static chrome.
    </footer>
  );
}
