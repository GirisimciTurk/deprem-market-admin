import { MessageSquare } from 'lucide-react'
import Header from '../../components/layout/Header'

export default function Reviews() {
  return (
    <>
      <Header title="Yorumlar" subtitle="Müşteri yorumlarını moderasyon et" />
      <div style={{ padding: '24px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: '16px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', background: 'var(--accent-success-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageSquare size={28} style={{ color: 'var(--accent-success)' }} />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Yorum Yönetimi</h3>
          <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 400 }}>
            Müşteri yorumlarını incele, onayla veya reddet. Yıldız puanlarını ve ürün geri bildirimlerini takip et.
          </p>
        </div>
      </div>
    </>
  )
}
