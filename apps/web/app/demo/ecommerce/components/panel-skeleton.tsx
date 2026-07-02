export function PanelSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
        padding: '1rem',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        background: '#f8fafc',
      }}
    >
      <div style={{ height: 20, width: '60%', background: '#e2e8f0', borderRadius: 4 }} />
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ height: 64, background: '#e2e8f0', borderRadius: 6 }} />
      ))}
    </div>
  );
}
