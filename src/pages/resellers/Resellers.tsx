import { Handshake } from 'lucide-react'
import Header from '../../components/layout/Header'

export default function Resellers() {
  return (
    <>
      <Header title="Bayilik Başvuruları" subtitle="Bayilik başvurularını incele ve onayla" />
      <div style={{ padding: '24px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: '16px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', background: 'var(--accent-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Handshake size={28} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Bayilik Yönetimi</h3>
          <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 400 }}>
            Bayilik başvurularını incele, onayla veya reddet. Aktif bayileri yönet ve performanslarını takip et.
          </p>
        </div>
      </div>
    </>
  )
}
