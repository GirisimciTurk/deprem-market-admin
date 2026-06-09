import { useState } from 'react'
import { PackageCheck, Truck, XCircle, RotateCcw } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { Spinner } from '../../components/ui/Spinner'
import type { Order } from '../../lib/types'
import { orderStatus, paymentStatus, fulfillmentStatus } from '../../lib/statusLabels'
import { formatMoney, formatDate, toMinor } from '../../lib/format'

interface Props {
  order: Order
  busy: boolean
  onClose: () => void
  onCancel: () => void
  onFulfill: () => void
  onShip: (trackingNumber?: string) => void
  onDeliver: () => void
  onRefund: (amountMinor?: number) => void
}

type PendingAction = 'cancel' | 'fulfill' | 'ship' | 'deliver' | 'refund' | null

export default function OrderDetail({ order, busy, onClose, onCancel, onFulfill, onShip, onDeliver, onRefund }: Props) {
  const [pending, setPending] = useState<PendingAction>(null)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [refundAmount, setRefundAmount] = useState('')

  const addr = order.shipping_address
  const isCanceled = order.status === 'canceled'
  const isDelivered = order.fulfillment_status === 'delivered'
  const isShipped = order.fulfillment_status === 'shipped' || order.fulfillment_status === 'delivered'
  const isFulfilled = !!order.fulfillment_status && order.fulfillment_status !== 'not_fulfilled'
  // Para iadesi: ödeme alınmış (authorized/captured/partially_refunded) ve henüz tam iade edilmemişse.
  const isRefundable = ['authorized', 'captured', 'partially_refunded'].includes(order.payment_status || '')

  const confirmConfig = {
    cancel: {
      title: 'Siparişi İptal Et',
      message: `#${order.display_id} numaralı siparişi iptal etmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      confirmLabel: 'Siparişi İptal Et',
      danger: true,
      run: onCancel,
    },
    fulfill: {
      title: 'Siparişi Hazırla',
      message: `#${order.display_id} için tüm ürünlerden bir fulfillment (hazırlık) oluşturulacak. Onaylıyor musunuz?`,
      confirmLabel: 'Hazırla',
      danger: false,
      run: onFulfill,
    },
    ship: {
      title: 'Kargoya Ver',
      message: `#${order.display_id} numaralı sipariş kargoya verilmiş olarak işaretlenecek. Aras Kargo takip numarasını girerseniz müşteriye takip linkiyle birlikte e-posta gider.`,
      confirmLabel: 'Kargoya Ver',
      danger: false,
      run: () => onShip(trackingNumber.trim() || undefined),
    },
    deliver: {
      title: 'Teslim Edildi Olarak İşaretle',
      message: `#${order.display_id} numaralı sipariş teslim edildi olarak işaretlenecek ve müşteriye "Teslim Edildi" e-postası gönderilecek. Onaylıyor musunuz?`,
      confirmLabel: 'Teslim Edildi',
      danger: false,
      run: onDeliver,
    },
    refund: {
      title: 'Para İadesi Yap',
      message: `#${order.display_id} için iade tutarını girin. Boş bırakırsanız iade edilebilir tutarın tamamı iade edilir. (Ödeme tahsil edilmemişse önce otomatik tahsil edilir.)`,
      confirmLabel: 'İadeyi Onayla',
      danger: true,
      run: () => {
        const tl = parseFloat(refundAmount.replace(',', '.'))
        onRefund(refundAmount.trim() && !Number.isNaN(tl) && tl > 0 ? toMinor(tl) : undefined)
      },
    },
  }

  const active = pending ? confirmConfig[pending] : null

  return (
    <Modal
      title={`Sipariş #${order.display_id}`}
      size="lg"
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 10, flexWrap: 'wrap' }}>
          <div className="row-actions">
            {!isCanceled && !isFulfilled && (
              <button className="btn btn--secondary" disabled={busy} onClick={() => setPending('fulfill')}>
                {busy ? <Spinner size={14} /> : <PackageCheck size={15} />} Hazırla
              </button>
            )}
            {!isCanceled && isFulfilled && !isShipped && (
              <button className="btn btn--primary" disabled={busy} onClick={() => setPending('ship')}>
                {busy ? <Spinner size={14} /> : <Truck size={15} />} Kargoya Ver
              </button>
            )}
            {!isCanceled && isShipped && !isDelivered && (
              <button className="btn btn--primary" disabled={busy} onClick={() => setPending('deliver')}>
                {busy ? <Spinner size={14} /> : <PackageCheck size={15} />} Teslim Edildi
              </button>
            )}
            {isRefundable && (
              <button className="btn btn--secondary" disabled={busy} onClick={() => setPending('refund')}>
                {busy ? <Spinner size={14} /> : <RotateCcw size={15} />} Para İadesi
              </button>
            )}
            {!isCanceled && (
              <button className="btn btn--danger" disabled={busy} onClick={() => setPending('cancel')}>
                <XCircle size={15} /> İptal Et
              </button>
            )}
          </div>
          <button className="btn btn--secondary" onClick={onClose}>
            Kapat
          </button>
        </div>
      }
    >
      {/* Status row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <Badge status={orderStatus(order.status)} />
        <Badge status={paymentStatus(order.payment_status)} />
        <Badge status={fulfillmentStatus(order.fulfillment_status)} />
        <span className="muted" style={{ marginLeft: 'auto', fontSize: '0.8rem' }}>
          {formatDate(order.created_at)}
        </span>
      </div>

      {/* Customer + address */}
      <div className="card" style={{ marginBottom: 18 }}>
        <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 10 }}>
          Müşteri & Teslimat
        </h4>
        <div style={{ fontSize: '0.875rem', lineHeight: 1.8 }}>
          <div><strong>{addr?.first_name} {addr?.last_name}</strong></div>
          <div className="muted">{order.email}</div>
          {addr?.phone && <div className="muted">{addr.phone}</div>}
          {addr?.address_1 && (
            <div style={{ marginTop: 6 }}>
              {addr.address_1} {addr.address_2}
              <br />
              {addr.postal_code} {addr.city} {addr.province} {addr.country_code?.toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="card">
        <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 12 }}>
          Ürünler ({order.items?.length ?? 0})
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(order.items ?? []).map((item) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {item.thumbnail ? (
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', objectFit: 'cover', border: '1px solid var(--border-primary)' }}
                />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)' }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.875rem' }}>{item.product_title || item.title}</div>
                {item.variant_title && <div className="muted" style={{ fontSize: '0.78rem' }}>{item.variant_title}</div>}
              </div>
              <div className="muted nowrap" style={{ fontSize: '0.82rem' }}>x{item.quantity}</div>
              <div className="nowrap" style={{ fontSize: '0.875rem', minWidth: 90, textAlign: 'right' }}>
                {formatMoney(item.unit_price, order.currency_code)}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-primary)', fontWeight: 700 }}>
          <span>Toplam</span>
          <span>{formatMoney(order.total, order.currency_code)}</span>
        </div>
      </div>

      {active && (
        <ConfirmDialog
          title={active.title}
          message={active.message}
          confirmLabel={active.confirmLabel}
          danger={active.danger}
          loading={busy}
          onConfirm={() => {
            active.run()
            setPending(null)
          }}
          onCancel={() => {
            setPending(null)
            setTrackingNumber('')
            setRefundAmount('')
          }}
        >
          {pending === 'ship' && (
            <div style={{ marginTop: 14 }}>
              <label
                htmlFor="tracking-number"
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  color: 'var(--text-tertiary)',
                  marginBottom: 6,
                }}
              >
                Aras Kargo Takip Numarası (opsiyonel)
              </label>
              <input
                id="tracking-number"
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Örn: 1234567890123"
                disabled={busy}
                style={{ width: '100%' }}
              />
              <p className="muted" style={{ fontSize: '0.75rem', marginTop: 6 }}>
                Boş bırakırsanız sipariş kargoya verildi olarak işaretlenir; takip numarasını
                sonra da girebilirsiniz.
              </p>
            </div>
          )}
          {pending === 'refund' && (
            <div style={{ marginTop: 14 }}>
              <label htmlFor="refund-amount" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                İade Tutarı (₺) — boş = tamamı
              </label>
              <input
                id="refund-amount"
                type="number"
                min="0"
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder={order.total != null ? (order.total / 100).toFixed(2) : 'Tutar'}
                disabled={busy}
                style={{ width: '100%' }}
              />
            </div>
          )}
        </ConfirmDialog>
      )}
    </Modal>
  )
}
