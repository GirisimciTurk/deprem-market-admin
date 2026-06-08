import { Package, Plus, Search, Filter } from 'lucide-react'
import Header from '../../components/layout/Header'

export default function Products() {
  return (
    <>
      <Header
        title="Ürünler"
        subtitle="Ürün kataloğunu yönet"
        actions={
          <button className="btn btn--primary">
            <Plus size={16} /> Ürün Ekle
          </button>
        }
      />
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <div className="header__search" style={{ flex: 1 }}>
            <Search size={16} />
            <input type="text" placeholder="Ürün ara..." className="header__search-input" style={{ width: '100%' }} />
          </div>
          <button className="btn btn--secondary">
            <Filter size={16} /> Filtrele
          </button>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: '16px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', background: 'var(--accent-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={28} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Ürün Yönetimi</h3>
          <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 400 }}>
            Medusa backend bağlandığında ürünleriniz burada listelenecek.
            Ürün ekleme, düzenleme, stok yönetimi ve daha fazlası.
          </p>
          <button className="btn btn--primary" style={{ marginTop: '8px' }}>
            <Plus size={16} /> İlk Ürünü Ekle
          </button>
        </div>
      </div>
    </>
  )
}
