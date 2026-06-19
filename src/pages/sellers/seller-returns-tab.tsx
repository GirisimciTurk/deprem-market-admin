import Badge from '../../components/ui/Badge'
import { formatMoney } from '../../lib/format'
import type { StatusMeta } from '../../lib/statusLabels'
import type { SellerReturnRow } from './seller-detail-types'

function returnBadge(status: string): StatusMeta {
  if (status === 'received') return { label: 'Teslim Alındı', variant: 'success' }
  return { label: 'Talep Edildi', variant: 'warning' }
}

export function ReturnsTab({ returns }: { returns: SellerReturnRow[] }) {
  if (returns.length === 0) {
    return <div className="card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>Bu satıcıya ait iade yok.</div>
  }
  return (
    <div className="table-container animate-fadeIn">
      <table>
        <thead><tr><th>Sipariş</th><th>Müşteri</th><th>Sebep</th><th>İade Tutarı</th><th>Durum</th><th>Tarih</th></tr></thead>
        <tbody>
          {returns.map((r) => (
            <tr key={r.id}>
              <td style={{ fontWeight: 600 }}>{r.display_id ? `#${r.display_id}` : '—'}</td>
              <td className="muted" style={{ fontSize: '0.84rem' }}>{r.customer_email || '—'}</td>
              <td className="muted" style={{ fontSize: '0.84rem', maxWidth: 220, wordBreak: 'break-word' }}>{r.reason || '—'}</td>
              <td className="nowrap">{formatMoney(r.returned_subtotal, r.currency_code)}</td>
              <td><Badge status={returnBadge(r.status)} /></td>
              <td className="muted" style={{ fontSize: '0.82rem' }}>{new Date(r.created_at).toLocaleDateString('tr-TR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
