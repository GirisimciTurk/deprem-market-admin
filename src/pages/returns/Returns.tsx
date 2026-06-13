import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Undo2, Eye, RotateCcw, Store, XCircle, Gavel } from 'lucide-react'
import Header from '../../components/layout/Header'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Pagination from '../../components/ui/Pagination'
import { Spinner, LoadingState } from '../../components/ui/Spinner'
import { EmptyState, ErrorState } from '../../components/ui/StateBox'
import { useToast } from '../../components/ui/toast-context'
import { api } from '../../lib/api'
import type { StatusMeta } from '../../lib/statusLabels'
import { formatDate, formatMoney } from '../../lib/format'

const LIMIT = 20

const STATUS_OPTIONS = [
  { value: '', label: 'Tümü' },
  { value: 'requested', label: 'Bekleyen (Satıcıda)' },
  { value: 'received', label: 'Teslim Alındı' },
  { value: 'rejected', label: 'Reddedildi' },
]

function srStatus(status: string): StatusMeta {
  if (status === 'received') return { label: 'Teslim Alındı', variant: 'success' }
  if (status === 'rejected') return { label: 'Reddedildi', variant: 'danger' }
  return { label: 'Bekliyor (Satıcıda)', variant: 'warning' }
}

interface SellerReturnItem {
  product_id?: string
  title?: string
  quantity: number
  unit_price: number
  line_total: number
}

interface AdminSellerReturn {
  id: string
  return_id: string
  order_id: string
  display_id?: string
  customer_email?: string | null
  currency_code?: string
  status: string
  reason?: string | null
  reject_reason?: string | null
  items?: SellerReturnItem[]
  returned_subtotal: number
  returned_commission: number
  returned_earning: number
  received_at?: string | null
  rejected_at?: string | null
  created_at: string
  seller?: { id: string; name: string; handle: string } | null
  order?: { paid_total: number; refunded_total: number } | null
}

interface ReturnsResponse {
  returns: AdminSellerReturn[]
  count: number
  offset: number
  limit: number
}

type Pending = 'accept' | 'uphold' | 'refund' | null

export default function Returns() {
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const [offset, setOffset] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<AdminSellerReturn | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [refundAmount, setRefundAmount] = useState('')

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['seller-returns', offset, statusFilter],
    queryFn: () =>
      api.get<ReturnsResponse>('/admin/seller-returns', {
        limit: LIMIT,
        offset,
        status: statusFilter || undefined,
      }),
    placeholderData: keepPreviousData,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['seller-returns'] })

  const arbitrateMutation = useMutation({
    mutationFn: ({ ret, action }: { ret: AdminSellerReturn; action: 'accept' | 'uphold_reject' }) =>
      api.post(`/admin/seller-returns/${ret.id}/arbitrate`, { action }),
    onSuccess: (_r, vars) => {
      notify(
        vars.action === 'accept'
          ? 'İade satıcı adına teslim alındı ve müşteriye ücret iadesi yapıldı.'
          : 'İade iptal edildi (ret onaylandı).'
      )
      refresh()
      setSelected(null)
      setPending(null)
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const refundMutation = useMutation({
    mutationFn: ({ ret, amount }: { ret: AdminSellerReturn; amount?: number }) =>
      api.post('/admin/order-refunds', amount ? { order_id: ret.order_id, amount } : { order_id: ret.order_id }),
    onSuccess: () => {
      notify('Para iadesi yapıldı.')
      refresh()
      setSelected(null)
      setPending(null)
      setRefundAmount('')
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const busy = arbitrateMutation.isPending || refundMutation.isPending
  const returns = data?.returns ?? []

  const refundableRemaining = (r: AdminSellerReturn | null) =>
    r ? Math.max(0, (r.order?.paid_total ?? 0) - (r.order?.refunded_total ?? 0)) : 0
  const cur = selected?.currency_code

  return (
    <>
      <Header
        title="İadeler"
        subtitle="Tüm satıcıların iade taleplerini izleyin; gerekirse hakem olarak müdahale edin"
      />
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setOffset(0)
            }}
            style={{ width: 'auto', minWidth: 200 }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <LoadingState label="İadeler yükleniyor..." />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : returns.length === 0 ? (
          <EmptyState
            icon={<Undo2 size={26} />}
            title="İade yok"
            description={statusFilter ? 'Bu duruma uygun iade bulunmuyor.' : 'Henüz hiç iade talebi oluşturulmamış.'}
          />
        ) : (
          <>
            <div
              className="table-container"
              style={{ opacity: isFetching ? 0.6 : 1, transition: 'opacity 0.15s' }}
            >
              <table>
                <thead>
                  <tr>
                    <th>Sipariş</th>
                    <th>Satıcı</th>
                    <th>Durum</th>
                    <th>İade Tutarı</th>
                    <th>Tarih</th>
                    <th style={{ textAlign: 'right' }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.map((r) => (
                    <tr key={r.id}>
                      <td className="nowrap">
                        <strong>#{r.display_id ?? '-'}</strong>
                        <div className="muted" style={{ fontSize: '0.78rem' }}>{r.customer_email}</div>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.875rem' }}>
                          <Store size={13} className="muted" /> {r.seller?.name ?? <span className="muted">—</span>}
                        </span>
                      </td>
                      <td>
                        <Badge status={srStatus(r.status)} />
                      </td>
                      <td className="nowrap">{formatMoney(r.returned_subtotal, r.currency_code)}</td>
                      <td className="nowrap muted" style={{ fontSize: '0.8rem' }}>
                        {formatDate(r.created_at)}
                      </td>
                      <td>
                        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn btn--secondary btn--sm" onClick={() => setSelected(r)}>
                            <Eye size={15} /> Detay
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination offset={offset} limit={LIMIT} count={data?.count ?? 0} onChange={setOffset} />
          </>
        )}
      </div>

      {selected && (
        <Modal
          title={`İade · Sipariş #${selected.display_id ?? ''}`}
          size="md"
          onClose={() => setSelected(null)}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 10, flexWrap: 'wrap' }}>
              <div className="row-actions">
                {selected.status !== 'received' && (
                  <>
                    <button className="btn btn--primary" disabled={busy} onClick={() => setPending('accept')}>
                      {busy ? <Spinner size={14} /> : <Gavel size={15} />} Satıcı Adına Kabul Et
                    </button>
                    <button
                      className="btn btn--secondary"
                      style={{ color: 'var(--accent-danger)' }}
                      disabled={busy}
                      onClick={() => setPending('uphold')}
                    >
                      <XCircle size={15} /> İadeyi İptal Et
                    </button>
                  </>
                )}
                {refundableRemaining(selected) > 0 && (
                  <button className="btn btn--secondary" disabled={busy} onClick={() => setPending('refund')}>
                    {busy ? <Spinner size={14} /> : <RotateCcw size={15} />} Manuel Para İadesi
                  </button>
                )}
              </div>
              <button className="btn btn--secondary" onClick={() => setSelected(null)}>
                Kapat
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
            <Badge status={srStatus(selected.status)} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.85rem' }} className="muted">
              <Store size={13} /> {selected.seller?.name}
            </span>
            <span className="muted" style={{ marginLeft: 'auto', fontSize: '0.8rem' }}>
              {formatDate(selected.created_at)}
            </span>
          </div>

          {selected.status === 'rejected' && selected.reject_reason && (
            <div
              className="card"
              style={{ marginBottom: 14, padding: '12px 14px', color: 'var(--accent-danger)', fontSize: '0.86rem' }}
            >
              <strong>Satıcının Ret Gerekçesi: </strong>
              {selected.reject_reason}
            </div>
          )}

          <div className="card">
            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 12 }}>
              İade Edilen Ürünler ({selected.items?.length ?? 0})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(selected.items ?? []).map((i, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.875rem' }}>{i.title || 'Ürün'}</div>
                  </div>
                  <div className="muted nowrap" style={{ fontSize: '0.82rem' }}>x{i.quantity}</div>
                  <div className="nowrap" style={{ fontSize: '0.875rem', minWidth: 90, textAlign: 'right' }}>
                    {formatMoney(i.line_total, selected.currency_code)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="card"
            style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.86rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="muted">İade Tutarı (müşteriye)</span>
              <span style={{ fontWeight: 600 }}>{formatMoney(selected.returned_subtotal, cur)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }} className="muted">
              <span>Geri alınan komisyon / kazanç</span>
              <span>{formatMoney(selected.returned_commission, cur)} / {formatMoney(selected.returned_earning, cur)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-primary)', paddingTop: 6 }} className="muted">
              <span>İade edilebilir kalan (sipariş)</span>
              <span>{formatMoney(refundableRemaining(selected), cur)}</span>
            </div>
          </div>

          <p className="muted" style={{ fontSize: '0.78rem', marginTop: 14, lineHeight: 1.6 }}>
            {selected.status === 'received'
              ? 'Bu iade teslim alınmış; stok geri eklenmiş, müşteriye ücret iadesi yapılmış ve satıcı bakiyesinden düşülmüştür.'
              : selected.status === 'rejected'
              ? 'Satıcı bu iadeyi reddetti. Müşteri haklıysa "Satıcı Adına Kabul Et" ile iadeyi onaylayıp ücret iadesi yapabilir; satıcı haklıysa "İadeyi İptal Et" ile reddi kesinleştirebilirsiniz.'
              : 'İade satıcının onayını bekliyor. Gerekirse hakem olarak satıcı adına kabul edebilir (teslim al + ücret iadesi) veya iadeyi iptal edebilirsiniz.'}
          </p>

          {pending === 'accept' && (
            <ConfirmDialog
              title="Satıcı Adına Kabul Et"
              message={`#${selected.display_id ?? ''} numaralı iade satıcı adına teslim alınacak: stok geri eklenecek, müşteriye ${formatMoney(
                Math.min(selected.returned_subtotal, refundableRemaining(selected)),
                cur
              )} ücret iadesi yapılacak ve satıcı bakiyesinden düşülecek. Onaylıyor musunuz?`}
              confirmLabel="Satıcı Adına Kabul Et"
              loading={busy}
              onConfirm={() => arbitrateMutation.mutate({ ret: selected, action: 'accept' })}
              onCancel={() => setPending(null)}
            />
          )}

          {pending === 'uphold' && (
            <ConfirmDialog
              title="İadeyi İptal Et"
              message={`#${selected.display_id ?? ''} numaralı iade iptal edilecek (ret kesinleşir): müşteriye ücret iadesi YAPILMAZ, stok geri eklenmez. Emin misiniz?`}
              confirmLabel="İadeyi İptal Et"
              danger
              loading={busy}
              onConfirm={() => arbitrateMutation.mutate({ ret: selected, action: 'uphold_reject' })}
              onCancel={() => setPending(null)}
            />
          )}

          {pending === 'refund' && (
            <ConfirmDialog
              title="Manuel Para İadesi"
              message={`Sipariş #${selected.display_id ?? ''} için iade tutarını girin. İade edilebilir kalan: ${formatMoney(
                refundableRemaining(selected),
                cur
              )}. Boş bırakırsanız kalanın tamamı iade edilir.`}
              confirmLabel="İadeyi Onayla"
              danger
              loading={busy}
              onConfirm={() => {
                const tl = parseFloat(refundAmount.replace(',', '.'))
                const amount = refundAmount.trim() && !Number.isNaN(tl) && tl > 0 ? Math.round(tl * 100) : undefined
                const rem = refundableRemaining(selected)
                if (amount && rem > 0 && amount > rem) {
                  notify(`Girilen tutar iade edilebilir kalandan (${formatMoney(rem, cur)}) fazla.`, 'error')
                  return
                }
                refundMutation.mutate({ ret: selected, amount })
              }}
              onCancel={() => {
                setPending(null)
                setRefundAmount('')
              }}
            >
              <div style={{ marginTop: 14 }}>
                <label htmlFor="admin-refund-amount" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                  İade Tutarı (₺) — boş = tamamı
                </label>
                <input
                  id="admin-refund-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder={(refundableRemaining(selected) / 100).toFixed(2)}
                  disabled={busy}
                  style={{ width: '100%' }}
                />
              </div>
            </ConfirmDialog>
          )}
        </Modal>
      )}
    </>
  )
}
