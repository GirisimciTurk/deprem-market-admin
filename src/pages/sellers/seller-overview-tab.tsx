import { Link } from 'react-router-dom'
import { Package, ShoppingBag, Wallet, Star, Percent } from 'lucide-react'
import { formatMoney } from '../../lib/format'
import type { SellerDetailResponse } from './seller-detail-types'
import { Kpi } from './seller-detail-ui'

export function OverviewTab({ data, cur }: { data: SellerDetailResponse; cur: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
        <Kpi icon={<Package size={18} />} label="Ürün" value={String(data.product_stats.total)}
          sub={`${data.product_stats.published} yayında · ${data.product_stats.proposed} onay bekliyor`} />
        <Kpi icon={<ShoppingBag size={18} />} label="Sipariş" value={String(data.order_stats.count)}
          sub={`${data.order_stats.fulfilled_count} kargolandı · ${data.order_stats.pending_ship_count} bekliyor`} />
        <Kpi icon={<Wallet size={18} />} label="Toplam Ciro" value={formatMoney(data.order_stats.gross, cur)}
          sub={`Komisyon: ${formatMoney(data.order_stats.commission, cur)}`} />
        <Kpi icon={<Star size={18} />} label="Puan"
          value={data.review_stats.rating_avg != null ? data.review_stats.rating_avg.toFixed(1) : '—'}
          sub={`${data.review_stats.rating_count} değerlendirme · ${data.review_stats.pending_count} onay bekliyor`} />
      </div>

      {/* Finansal özet */}
      <div className="card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wallet size={16} /> Finansal Özet
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px' }}>
          <Kpi label="Net Kazanç" value={formatMoney(data.order_stats.earning_net, cur)} sub="İade düşülmüş" />
          <Kpi label="Hakediş Bekleyen" value={formatMoney(data.payout.pending_balance, cur)} />
          <Kpi label="Ödenebilir Bakiye" value={formatMoney(data.payout.eligible_balance, cur)} highlight />
          <Kpi label="Ödenen" value={formatMoney(data.payout.paid_total, cur)} />
          <Kpi label="İade Edilen" value={formatMoney(data.payout.total_returned, cur)}
            sub={`${data.return_stats.count} iade`} />
        </div>
      </div>

      {/* Komisyon bilgi notu */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <Percent size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
          <strong>Komisyon önceliği:</strong> Bir kalemin komisyonu önce ürünün <Link to="/commission-rules" style={{ color: 'var(--accent-primary)' }}>kategori kuralından</Link> belirlenir;
          kategori kuralı yoksa bu satıcının sabit oranı (<strong>%{data.seller.commission_rate}</strong>) uygulanır.
          Ana mağaza ürünleri komisyonsuzdur (%0). Satıcının sabit oranını <em>Bilgiler & Ayarlar</em> sekmesinden değiştirebilirsiniz.
        </div>
      </div>
    </div>
  )
}
