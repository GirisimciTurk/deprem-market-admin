import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { ShoppingCart, Eye, Search } from 'lucide-react'
import Header from '../../components/layout/Header'
import Badge from '../../components/ui/Badge'
import Pagination from '../../components/ui/Pagination'
import { LoadingState } from '../../components/ui/Spinner'
import { EmptyState, ErrorState } from '../../components/ui/StateBox'
import { useToast } from '../../components/ui/toast-context'
import { useDebounce } from '../../lib/useDebounce'
import { api } from '../../lib/api'
import { getTrackingUrl } from '../../lib/cargo'
import type { Order } from '../../lib/types'
import { orderStatus, paymentStatus, fulfillmentStatus } from '../../lib/statusLabels'
import { formatMoney, formatDate } from '../../lib/format'
import OrderDetail from './OrderDetail'

const LIMIT = 20
const ORDER_FIELDS =
  'id,display_id,email,status,payment_status,fulfillment_status,total,currency_code,created_at,*items,*shipping_address,*fulfillments'

interface OrdersResponse {
  orders: Order[]
  count: number
  offset: number
  limit: number
}

const STATUS_OPTIONS = [
  { value: '', label: 'Tüm Durumlar' },
  { value: 'pending', label: 'Beklemede' },
  { value: 'completed', label: 'Tamamlandı' },
  { value: 'canceled', label: 'İptal Edildi' },
  { value: 'archived', label: 'Arşivlendi' },
]

export default function Orders() {
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<Order | null>(null)

  const debouncedSearch = useDebounce(search)

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['orders', offset, debouncedSearch, statusFilter],
    queryFn: () =>
      api.get<OrdersResponse>('/admin/orders', {
        limit: LIMIT,
        offset,
        fields: ORDER_FIELDS,
        order: '-created_at',
        q: debouncedSearch || undefined,
        status: statusFilter || undefined,
      }),
    placeholderData: keepPreviousData,
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/orders/${id}/cancel`),
    onSuccess: () => {
      notify('Sipariş iptal edildi.')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setSelected(null)
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const fulfillMutation = useMutation({
    mutationFn: (order: Order) =>
      api.post(`/admin/orders/${order.id}/fulfillments`, {
        items: (order.items ?? []).map((i) => ({ id: i.id, quantity: i.quantity })),
      }),
    onSuccess: () => {
      notify('Sipariş hazırlandı (fulfillment oluşturuldu).')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setSelected(null)
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const shipMutation = useMutation({
    mutationFn: ({ order, trackingNumber }: { order: Order; trackingNumber?: string }) => {
      const fulfillment = (order.fulfillments ?? []).find((f) => !f.shipped_at && !f.canceled_at)
      if (!fulfillment) {
        return Promise.reject(
          new Error('Kargolanacak hazır bir fulfillment bulunamadı. Önce "Hazırla" deyin.')
        )
      }
      // Takip numarası girildiyse Aras takip linkiyle birlikte label olarak gönder.
      const labels = trackingNumber
        ? [
            {
              tracking_number: trackingNumber,
              tracking_url: getTrackingUrl(trackingNumber, fulfillment.provider_id) ?? '',
              label_url: '',
            },
          ]
        : []
      return api.post(`/admin/orders/${order.id}/fulfillments/${fulfillment.id}/shipments`, {
        items: (order.items ?? []).map((i) => ({ id: i.id, quantity: i.quantity })),
        labels,
      })
    },
    onSuccess: () => {
      notify('Sipariş kargoya verildi.')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setSelected(null)
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const deliverMutation = useMutation({
    mutationFn: (order: Order) => {
      const fulfillment = (order.fulfillments ?? []).find(
        (f) => f.shipped_at && !f.delivered_at && !f.canceled_at
      )
      if (!fulfillment) {
        return Promise.reject(
          new Error('Teslim edilecek kargolanmış bir gönderi bulunamadı.')
        )
      }
      return api.post(
        `/admin/orders/${order.id}/fulfillments/${fulfillment.id}/mark-as-delivered`
      )
    },
    onSuccess: () => {
      notify('Sipariş teslim edildi olarak işaretlendi.')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setSelected(null)
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const refundMutation = useMutation({
    mutationFn: ({ order, amount }: { order: Order; amount?: number }) =>
      api.post(`/admin/order-refunds`, amount ? { order_id: order.id, amount } : { order_id: order.id }),
    onSuccess: () => {
      notify('Para iadesi yapıldı.')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setSelected(null)
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const orders = data?.orders ?? []
  const busy =
    cancelMutation.isPending ||
    fulfillMutation.isPending ||
    shipMutation.isPending ||
    deliverMutation.isPending ||
    refundMutation.isPending

  return (
    <>
      <Header title="Siparişler" subtitle="Sipariş durumlarını takip et ve yönet" />
      <div style={{ padding: '24px' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div className="header__search" style={{ flex: 1, minWidth: 220 }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Sipariş no veya e-posta ile ara..."
              className="header__search-input"
              style={{ width: '100%' }}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setOffset(0)
              }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setOffset(0)
            }}
            style={{ width: 'auto', minWidth: 180 }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <LoadingState label="Siparişler yükleniyor..." />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart size={26} />}
            title="Sipariş bulunamadı"
            description={
              debouncedSearch || statusFilter
                ? 'Arama/filtre kriterlerinize uygun sipariş yok.'
                : 'Henüz hiç sipariş oluşturulmamış.'
            }
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
                    <th>Müşteri</th>
                    <th>Tutar</th>
                    <th>Ödeme</th>
                    <th>Kargo</th>
                    <th>Tarih</th>
                    <th style={{ textAlign: 'right' }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="nowrap">
                        <strong>#{o.display_id}</strong>
                        <div style={{ marginTop: 4 }}>
                          <Badge status={orderStatus(o.status)} />
                        </div>
                      </td>
                      <td>
                        <div>
                          {o.shipping_address?.first_name} {o.shipping_address?.last_name}
                        </div>
                        <div className="muted" style={{ fontSize: '0.78rem' }}>
                          {o.email}
                        </div>
                      </td>
                      <td className="nowrap">{formatMoney(o.total, o.currency_code)}</td>
                      <td>
                        <Badge status={paymentStatus(o.payment_status)} />
                      </td>
                      <td>
                        <Badge status={fulfillmentStatus(o.fulfillment_status)} />
                      </td>
                      <td className="nowrap muted" style={{ fontSize: '0.8rem' }}>
                        {formatDate(o.created_at)}
                      </td>
                      <td>
                        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn btn--secondary btn--sm" onClick={() => setSelected(o)}>
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
        <OrderDetail
          order={selected}
          busy={busy}
          onClose={() => setSelected(null)}
          onCancel={() => cancelMutation.mutate(selected.id)}
          onFulfill={() => fulfillMutation.mutate(selected)}
          onShip={(trackingNumber) => shipMutation.mutate({ order: selected, trackingNumber })}
          onDeliver={() => deliverMutation.mutate(selected)}
          onRefund={(amount) => refundMutation.mutate({ order: selected, amount })}
        />
      )}
    </>
  )
}
