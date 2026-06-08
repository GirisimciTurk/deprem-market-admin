import { Users } from 'lucide-react'
import Header from '../../components/layout/Header'

export default function Customers() {
  return (
    <>
      <Header title="Müşteriler" subtitle="Müşteri listesi ve detayları" />
      <div style={{ padding: '24px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: '16px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', background: 'var(--accent-info-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={28} style={{ color: 'var(--accent-info)' }} />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Müşteri Yönetimi</h3>
          <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 400 }}>
            Müşteri profillerini görüntüle, sipariş geçmişlerini takip et ve müşteri segmentasyonu yap.
          </p>
        </div>
      </div>
    </>
  )
}
