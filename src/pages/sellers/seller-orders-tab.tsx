import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Wallet } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Pagination from '../../components/ui/Pagination'
import { LoadingState } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/StateBox'
import { useToast } from '../../components/ui/toast-context'
import { api } from '../../lib/api'
import { formatMoney } from '../../lib/format'
import type { StatusMeta } from '../../lib/statusLabels'
import type { SellerOrderRow, PayoutSummary } from './seller-detail-types'
import { Kpi } from './seller-detail-ui'

const ORDER_LIMIT = 20

function payoutBadge(status: string): StatusMeta {
  if (status === 'paid') return { label: 'Ödendi', variant: 'success' }
  if (status === 'eligible') return { label: 'Ödenebilir', variant: 'info' }
  return { label: 'Hakediş Bekliyor', variant: 'warning' }
}
function fulfillBadge(status: string): StatusMeta {
  if (status === 'fulfilled') return { label: 'Kargolandı', variant: 'success' }
  if (status === 'canceled') return { label: 'İptal', variant: 'danger' }
  return { label: 'Hazırlanıyor', variant: 'warning' }
}

export function OrdersTab({ sellerId, sellerName }: { sellerId: string; sellerName: string }) {
  const { notify } = useToast()
  const qc = useQueryClient()
  const [offset, setOffset] = useState(0)
  const [filter, setFilter] = useState('')

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['seller-orders', sellerId, filter, offset],
    queryFn: () =>
      api.get<{ orders: SellerOrderRow[]; count: number; summary: PayoutSummary }>(
        `/admin/sellers/${sellerId}/orders`, { payout: filter || undefined, limit: ORDER_LIMIT, offset }),
    placeholderData: keepPreviousData,
  })
  const orders = data?.orders ?? []
  const summary = data?.summary
  const cur = summary?.currency_code
  const eligible = summary?.eligible_balance ?? 0

  const payoutM = useMutation({
    mutationFn: () => api.post<{ paid_count: number; paid_amount?: number; message?: string }>(`/admin/sellers/${sellerId}/payout`, {}),
    onSuccess: (r) => {
      notify(r.paid_count > 0 ? `${r.paid_count} sipariş ödendi (${formatMoney(r.paid_amount, cur)}).` : (r.message || 'Ödenebilir sipariş yok.'))
      qc.invalidateQueries({ queryKey: ['seller-orders', sellerId] })
      qc.invalidateQueries({ queryKey: ['seller-detail', sellerId] })
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })
  const settleM = useMutation({
    mutationFn: () => api.post<{ settled: number; hakedis_days: number }>('/admin/settle-payouts', {}),
    onSuccess: (r) => { notify(`${r.settled} sipariş hakediş etti (${r.hakedis_days} gün).`); qc.invalidateQueries({ queryKey: ['seller-orders', sellerId] }) },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <Kpi label="Toplam Kazanç" value={formatMoney(summary?.total_earning, cur)} />
        <Kpi label="Toplam Komisyon" value={formatMoney(summary?.total_commission, cur)} />
        <Kpi label="Hakediş Bekleyen" value={formatMoney(summary?.pending_balance, cur)} />
        <Kpi label="Ödenebilir" value={formatMoney(eligible, cur)} highlight />
        <Kpi label="Ödenen" value={formatMoney(summary?.paid_total, cur)} />
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <select value={filter} onChange={(e) => { setFilter(e.target.value); setOffset(0) }} style={{ width: 'auto', minWidth: 160 }}>
          <option value="">Tümü</option>
          <option value="pending">Hakediş Bekleyen</option>
          <option value="eligible">Ödenebilir</option>
          <option value="paid">Ödenen</option>
        </select>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn--secondary" onClick={() => settleM.mutate()} disabled={settleM.isPending}
            title="Hakediş süresi dolan kargolanmış siparişleri ödenebilir yapar">
            {settleM.isPending ? 'Çalışıyor...' : 'Hakedişi Çalıştır'}
          </button>
          <button className="btn btn--primary" disabled={eligible <= 0 || payoutM.isPending}
            onClick={() => { if (window.confirm(`"${sellerName}" için ödenebilir tüm siparişleri ödendi işaretle?`)) payoutM.mutate() }}>
            <Wallet size={16} /> {payoutM.isPending ? 'İşleniyor...' : 'Ödenebilirleri Öde'}
          </button>
        </div>
      </div>

      {isLoading ? <LoadingState label="Siparişler yükleniyor..." />
        : isError ? <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        : orders.length === 0 ? (
          <div className="card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
            {filter ? 'Bu filtreye uygun sipariş yok.' : 'Bu satıcıya ait sipariş bulunmuyor.'}
          </div>
        ) : (
          <>
            <div className="table-container animate-fadeIn" style={{ opacity: isFetching ? 0.7 : 1 }}>
              <table>
                <thead>
                  <tr><th>#</th><th>Tarih</th><th>Adet</th><th>Ara Toplam</th><th>Komisyon</th><th>Kazanç</th><th>Kargo</th><th>Ödeme</th></tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 600 }}>#{o.display_id}</td>
                      <td className="muted" style={{ fontSize: '0.82rem' }}>{new Date(o.created_at).toLocaleDateString('tr-TR')}</td>
                      <td className="muted">{o.item_count}</td>
                      <td className="nowrap">{formatMoney(o.subtotal, o.currency_code)}</td>
                      <td className="nowrap">{formatMoney(o.commission_amount, o.currency_code)}</td>
                      <td className="nowrap" style={{ fontWeight: 600 }}>{formatMoney(o.seller_earning, o.currency_code)}</td>
                      <td>
                        <Badge status={fulfillBadge(o.fulfillment_status)} />
                        {o.tracking_number && (
                          <div style={{ fontSize: '0.75rem', marginTop: 4 }}>
                            <span className="muted">{o.carrier ? `${o.carrier}: ` : ''}{o.tracking_number}</span>
                            {o.tracking_url && <a href={o.tracking_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', color: 'var(--accent-primary)' }}>Kargom Nerede?</a>}
                          </div>
                        )}
                      </td>
                      <td><Badge status={payoutBadge(o.payout_status)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination offset={offset} limit={ORDER_LIMIT} count={data?.count ?? 0} onChange={setOffset} />
          </>
        )}
    </div>
  )
}
