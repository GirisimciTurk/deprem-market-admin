import { Package } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import type { StatusMeta } from '../../lib/statusLabels'
import type { SellerProduct } from './seller-detail-types'

function productStatusBadge(status: string): StatusMeta {
  if (status === 'published') return { label: 'Yayında', variant: 'success' }
  if (status === 'proposed' || status === 'draft') return { label: 'Onay Bekliyor', variant: 'warning' }
  if (status === 'rejected') return { label: 'Reddedildi', variant: 'danger' }
  return { label: status, variant: 'neutral' }
}

export function ProductsTab({ products }: { products: SellerProduct[] }) {
  if (products.length === 0) {
    return <div className="card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>Bu satıcının ürünü yok.</div>
  }
  return (
    <div className="table-container animate-fadeIn">
      <table>
        <thead><tr><th>Ürün</th><th>Durum</th><th>Eklenme</th></tr></thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--bg-tertiary)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {p.thumbnail ? <img src={p.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={16} className="muted" />}
                  </div>
                  <span style={{ fontWeight: 500, fontSize: '0.88rem' }}>{p.title}</span>
                </div>
              </td>
              <td><Badge status={productStatusBadge(p.status)} /></td>
              <td className="muted" style={{ fontSize: '0.82rem' }}>{new Date(p.created_at).toLocaleDateString('tr-TR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
