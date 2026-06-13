import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Undo2, Eye, PackageCheck, RotateCcw } from 'lucide-react'
import Header from '../../components/layout/Header'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Pagination from '../../components/ui/Pagination'
import { Spinner, LoadingState } from '../../components/ui/Spinner'
import { EmptyState, ErrorState } from '../../components/ui/StateBox'
import { useToast } from '../../components/ui/toast-context'
import { api } from '../../lib/api'
import { returnStatus } from '../../lib/statusLabels'
import { formatDate, formatMoney } from '../../lib/format'

const LIMIT = 20
const RETURN_FIELDS = [
  'id',
  'status',
  'order_id',
  'display_id',
  'created_at',
  'items.id',
  'items.item_id',
  'items.quantity',
  'items.received_quantity',
  'items.reason.label',
  'items.item.title',
  'items.item.product_title',
  'items.item.unit_price',
  // NOT: `order` ilişkisi BİLEREK burada yok. /admin/returns'te `order` ilişkisini
  // genişletirken aynı anda `order=-created_at` sıralama parametresi gönderince Medusa
  // ikisini karıştırıp `Order.name`'e göre sıralamaya çalışıyor → 500. Sipariş bilgisi
  // (display_id/email/currency) ayrı bir /admin/orders çağrısıyla çekilip birleştiriliyor.
].join(',')

interface ReturnItem {
  id: string
  item_id: string
  quantity: number
  received_quantity?: number
  reason?: { label?: string } | null
  item?: { title?: string; product_title?: string; unit_price?: number } | null
}

interface ReturnRecord {
  id: string
  status: string
  order_id: string
  display_id?: number
  created_at: string
  items?: ReturnItem[]
  order?: {
    display_id?: number
    email?: string
    currency_code?: string
    /** Siparişte şimdiye dek iade edilmiş toplam (kuruş). */
    refunded_total?: number
    /** Siparişte tahsil edilmiş toplam (kuruş) — iade edilebilir tavanı belirler. */
    paid_total?: number
  } | null
}

// İade edilen kalemlerin toplam değeri (minor unit/kuruş) = onaylanınca iade edilecek tutar.
const returnRefundMinor = (ret: ReturnRecord) =>
  (ret.items ?? []).reduce(
    (sum, i) => sum + (i.quantity || 0) * (i.item?.unit_price || 0),
    0
  )

interface ReturnsResponse {
  returns: ReturnRecord[]
  count: number
  offset: number
  limit: number
}

export default function Returns() {
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<ReturnRecord | null>(null)
  const [pending, setPending] = useState<'approve' | 'refund' | null>(null)
  const [refundAmount, setRefundAmount] = useState('')

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['returns', offset],
    queryFn: async () => {
      const res = await api.get<ReturnsResponse>('/admin/returns', {
        limit: LIMIT,
        offset,
        fields: RETURN_FIELDS,
        order: '-created_at',
      })
      // Sipariş bilgisini ayrı çek (order ilişkisi + sıralama Medusa'da çakışıyor, bkz. RETURN_FIELDS notu).
      const orderIds = [...new Set((res.returns ?? []).map((r) => r.order_id).filter(Boolean))]
      if (orderIds.length) {
        const qs = orderIds.map((id) => `id[]=${encodeURIComponent(id)}`).join('&')
        // summary.* gerekiyor: spesifik summary.x alanları null dönüyor (computed field).
        const ordersRes = await api.get<{
          orders: { id: string; display_id?: number; email?: string; currency_code?: string; summary?: { refunded_total?: number; paid_total?: number } }[]
        }>(`/admin/orders?fields=id,display_id,email,currency_code,summary.*&limit=${orderIds.length}&${qs}`)
        const byId = new Map((ordersRes.orders ?? []).map((o) => [o.id, o]))
        res.returns.forEach((r) => {
          const o = byId.get(r.order_id)
          if (o)
            r.order = {
              display_id: o.display_id,
              email: o.email,
              currency_code: o.currency_code,
              refunded_total: o.summary?.refunded_total,
              paid_total: o.summary?.paid_total,
            }
        })
      }
      return res
    },
    placeholderData: keepPreviousData,
  })

  // İadeyi ONAYLA (tek akış):
  //  1) Teslim al: begin-receive → receive-items → confirm
  //     (confirm managed-inventory variantları için stoğu OTOMATİK geri ekler ve
  //      order.return_received event'iyle müşteriye "İadeniz Teslim Alındı" maili gider).
  //  2) İade edilen kalemlerin değerini müşteriye geri öde (/admin/order-refunds).
  const approveMutation = useMutation({
    mutationFn: async (ret: ReturnRecord) => {
      const items = (ret.items ?? [])
        .filter((i) => i.quantity > 0)
        .map((i) => ({ id: i.item_id, quantity: i.quantity }))
      if (!items.length) throw new Error('Onaylanacak kalem bulunamadı.')
      // 1) Teslim al + stok + mail
      await api.post(`/admin/returns/${ret.id}/receive`, {})
      await api.post(`/admin/returns/${ret.id}/receive-items`, { items })
      await api.post(`/admin/returns/${ret.id}/receive/confirm`, {})
      // 2) İade edilen kalemlerin değerini iade et — ama siparişte GERÇEKTEN iade edilebilen kadar.
      // Ödenmemiş sipariş (paid=0) veya tutarı önceden iade edilmiş siparişte iade adımı atlanır,
      // aksi halde order-refunds 400 verir ve stok geri eklenmiş ama akış hata vermiş olur.
      const refundable = Math.max(0, (ret.order?.paid_total ?? 0) - (ret.order?.refunded_total ?? 0))
      const amount = Math.min(returnRefundMinor(ret), refundable)
      const refunded = amount > 0
      if (refunded) {
        await api.post('/admin/order-refunds', { order_id: ret.order_id, amount })
      }
      return { refunded, amount }
    },
    onSuccess: (r) => {
      notify(
        r.refunded
          ? `İade onaylandı: stok geri eklendi, ${formatMoney(r.amount, cur)} ücret iadesi yapıldı, müşteriye e-posta gönderildi.`
          : 'İade onaylandı: stok geri eklendi, müşteriye e-posta gönderildi. (Siparişte iade edilecek tahsilat yok.)'
      )
      queryClient.invalidateQueries({ queryKey: ['returns'] })
      setSelected(null)
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  // Para iadesi: mevcut /admin/order-refunds ucu (gerekirse capture + Paynkolay iade).
  const refundMutation = useMutation({
    mutationFn: ({ ret, amount }: { ret: ReturnRecord; amount?: number }) =>
      api.post(
        '/admin/order-refunds',
        amount ? { order_id: ret.order_id, amount } : { order_id: ret.order_id }
      ),
    onSuccess: () => {
      notify('Para iadesi yapıldı.')
      queryClient.invalidateQueries({ queryKey: ['returns'] })
      setSelected(null)
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const returns = data?.returns ?? []
  const busy = approveMutation.isPending || refundMutation.isPending

  const canReceive = (s: string) => s === 'requested' || s === 'partially_received'

  // Seçili iadenin siparişinde para durumu (modal için).
  const refundedTotal = selected?.order?.refunded_total ?? 0
  const paidTotal = selected?.order?.paid_total ?? 0
  const refundableRemaining = Math.max(0, paidTotal - refundedTotal)
  // Tahsilat bilgisi var ve iade edilebilir bakiye kalmadıysa manuel iade engellenir (çift-iade önleme).
  const nothingRefundable = paidTotal > 0 && refundableRemaining <= 0
  const cur = selected?.order?.currency_code
  // Onayda gerçekten iade edilecek tutar = kalem değeri ile iade-edilebilir bakiyenin küçüğü.
  const approveRefund = selected ? Math.min(returnRefundMinor(selected), refundableRemaining) : 0

  return (
    <>
      <Header title="İadeler" subtitle="Tüm satıcıların iade taleplerini izleyin; teslim alın ve ücret iadesi yapın" />
      <div style={{ padding: '24px' }}>
        {isLoading ? (
          <LoadingState label="İadeler yükleniyor..." />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : returns.length === 0 ? (
          <EmptyState
            icon={<Undo2 size={26} />}
            title="İade talebi yok"
            description="Henüz hiç iade talebi oluşturulmamış. Müşteriler hesaplarından iade talebi açtığında burada listelenir."
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
                    <th>İade No</th>
                    <th>Sipariş</th>
                    <th>Durum</th>
                    <th>Ürünler</th>
                    <th>Tarih</th>
                    <th style={{ textAlign: 'right' }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.map((r) => (
                    <tr key={r.id}>
                      <td className="nowrap">
                        <strong>#{r.display_id ?? r.id.substring(0, 8)}</strong>
                      </td>
                      <td className="nowrap">
                        <div>#{r.order?.display_id ?? '-'}</div>
                        <div className="muted" style={{ fontSize: '0.78rem' }}>
                          {r.order?.email}
                        </div>
                      </td>
                      <td>
                        <Badge status={returnStatus(r.status)} />
                      </td>
                      <td className="nowrap muted">
                        {(r.items ?? []).reduce((sum, i) => sum + (i.quantity || 0), 0)} adet
                      </td>
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
          title={`İade #${selected.display_id ?? selected.id.substring(0, 8)}`}
          size="md"
          onClose={() => setSelected(null)}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 10, flexWrap: 'wrap' }}>
              <div className="row-actions">
                {canReceive(selected.status) && (
                  <button className="btn btn--primary" disabled={busy} onClick={() => setPending('approve')}>
                    {busy ? <Spinner size={14} /> : <PackageCheck size={15} />} İadeyi Onayla
                  </button>
                )}
                <button
                  className="btn btn--secondary"
                  disabled={busy || nothingRefundable}
                  title={nothingRefundable ? 'Bu siparişin iade edilebilir bakiyesi kalmadı.' : undefined}
                  onClick={() => setPending('refund')}
                >
                  {busy ? <Spinner size={14} /> : <RotateCcw size={15} />} Manuel Para İadesi
                </button>
              </div>
              <button className="btn btn--secondary" onClick={() => setSelected(null)}>
                Kapat
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
            <Badge status={returnStatus(selected.status)} />
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              Sipariş #{selected.order?.display_id ?? '-'} · {selected.order?.email}
            </span>
            <span className="muted" style={{ marginLeft: 'auto', fontSize: '0.8rem' }}>
              {formatDate(selected.created_at)}
            </span>
          </div>

          <div className="card">
            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 12 }}>
              İade Edilen Ürünler ({selected.items?.length ?? 0})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(selected.items ?? []).map((i) => (
                <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.875rem' }}>{i.item?.product_title || i.item?.title || 'Ürün'}</div>
                    {i.reason?.label && (
                      <div className="muted" style={{ fontSize: '0.78rem' }}>Sebep: {i.reason.label}</div>
                    )}
                  </div>
                  <div className="muted nowrap" style={{ fontSize: '0.82rem' }}>x{i.quantity}</div>
                </div>
              ))}
            </div>
          </div>

          {refundedTotal > 0 ? (
            // Bu siparişte zaten iade yapılmış (onay akışı veya manuel) → yanlış "iade edilecek" gösterme.
            <div
              className="card"
              style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>İade edildi</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--success, #16a34a)' }}>
                  {formatMoney(refundedTotal, cur)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }} className="muted">
                <span>İade edilebilir kalan</span>
                <span>{formatMoney(refundableRemaining, cur)}</span>
              </div>
            </div>
          ) : approveRefund > 0 ? (
            <div
              className="card"
              style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Onaylanınca iade edilecek</span>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent, #e11d48)' }}>
                {formatMoney(approveRefund, cur)}
              </span>
            </div>
          ) : null}

          <p className="muted" style={{ fontSize: '0.78rem', marginTop: 14, lineHeight: 1.6 }}>
            {canReceive(selected.status) ? (
              <>
                <strong>"İadeyi Onayla"</strong>: iadeyi teslim alınmış işaretler → stoğu geri ekler →{' '}
                {approveRefund > 0
                  ? `müşteriye ${formatMoney(approveRefund, cur)} ücret iadesi yapar →`
                  : 'siparişte iade edilecek tahsilat olmadığı için ücret iadesi yapılmaz →'}{' '}
                müşteriye onay e-postası gönderir.
                {approveRefund > 0 && ' Farklı/kısmi bir tutar iade etmek için "Manuel Para İadesi"ni kullanın.'}
              </>
            ) : nothingRefundable ? (
              <>Bu siparişin iade edilebilir bakiyesi kalmadı (tutar zaten iade edildi). Ek iade yapılamaz.</>
            ) : (
              <>Bu iade teslim alınmış. Kalan tutarı iade etmek için "Manuel Para İadesi"ni kullanın.</>
            )}
          </p>

          {pending === 'approve' && (
            <ConfirmDialog
              title="İadeyi Onayla"
              message={`#${selected.display_id ?? ''} numaralı iade onaylanacak: stok geri eklenecek, ${
                approveRefund > 0
                  ? `müşteriye ${formatMoney(approveRefund, cur)} ücret iadesi yapılacak`
                  : 'ücret iadesi gerekmiyor (siparişte iade edilecek tahsilat yok)'
              } ve müşteriye onay e-postası gönderilecek. Onaylıyor musunuz?`}
              confirmLabel="İadeyi Onayla"
              danger={false}
              loading={busy}
              onConfirm={() => {
                approveMutation.mutate(selected)
                setPending(null)
              }}
              onCancel={() => setPending(null)}
            />
          )}

          {pending === 'refund' && (
            <ConfirmDialog
              title="Para İadesi Yap"
              message={`Sipariş #${selected.order?.display_id ?? ''} için iade tutarını girin. İade edilebilir kalan: ${formatMoney(refundableRemaining, cur)}. Boş bırakırsanız kalanın tamamı iade edilir.`}
              confirmLabel="İadeyi Onayla"
              danger
              loading={busy}
              onConfirm={() => {
                const tl = parseFloat(refundAmount.replace(',', '.'))
                const amount = refundAmount.trim() && !Number.isNaN(tl) && tl > 0 ? Math.round(tl * 100) : undefined
                // Girilen tutar kalan bakiyeyi aşıyorsa backend'e gitmeden uyar.
                if (amount && refundableRemaining > 0 && amount > refundableRemaining) {
                  notify(`Girilen tutar iade edilebilir kalandan (${formatMoney(refundableRemaining, cur)}) fazla.`, 'error')
                  return
                }
                refundMutation.mutate({ ret: selected, amount })
                setPending(null)
                setRefundAmount('')
              }}
              onCancel={() => {
                setPending(null)
                setRefundAmount('')
              }}
            >
              <div style={{ marginTop: 14 }}>
                <label htmlFor="return-refund-amount" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                  İade Tutarı (₺) — boş = tamamı
                </label>
                <input
                  id="return-refund-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder={(refundableRemaining / 100).toFixed(2)}
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
