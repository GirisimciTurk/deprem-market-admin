import type { ReactNode } from 'react'

/* Satıcı detay sekmelerinde paylaşılan sunum/layout yardımcıları. */

export function Kpi({ icon, label, value, sub, highlight }: { icon?: ReactNode; label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? 'var(--accent-primary-light, var(--bg-tertiary))' : 'var(--bg-secondary)',
      border: highlight ? '1px solid var(--accent-primary)' : '1px solid var(--border-primary)',
      borderRadius: 'var(--radius-md)', padding: '14px 16px',
    }}>
      <div className="muted" style={{ fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {icon}{label}
      </div>
      <div style={{ fontWeight: 700, fontSize: '1.15rem', marginTop: '6px', color: highlight ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: '0.74rem', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card" style={{ padding: '20px' }}>
      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '16px' }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>{children}</div>
    </div>
  )
}

export function Grid({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>{children}</div>
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
      {children}
    </label>
  )
}
