import { ShoppingCart } from 'lucide-react'
import Header from '../../components/layout/Header'

export default function Orders() {
  return (
    <>
      <Header title="Siparişler" subtitle="Sipariş durumlarını takip et ve yönet" />
      <div style={{ padding: '24px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: '16px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', background: 'var(--accent-success-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingCart size={28} style={{ color: 'var(--accent-success)' }} />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Sipariş Yönetimi</h3>
          <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 400 }}>
            Siparişleri görüntüle, durumlarını güncelle, kargo takip numarasını ekle ve müşterilerle iletişim kur.
          </p>
        </div>
      </div>
    </>
  )
}
