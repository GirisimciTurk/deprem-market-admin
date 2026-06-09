import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, Mail, Phone, ShoppingBag, User, Pencil, Save, X } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import { LoadingState, Spinner } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/StateBox'
import Badge from '../../components/ui/Badge'
import { useToast } from '../../components/ui/toast-context'
import { api } from '../../lib/api'
import { formatDate, formatMoney } from '../../lib/format'
import { orderStatus } from '../../lib/statusLabels'
import type { Customer, Order } from '../../lib/types'

interface CustomerDetailProps {
  customer: Customer
  onClose: () => void
}

interface OrdersResponse {
  orders: Order[]
  count: number
}

export default function CustomerDetail({ customer, onClose }: CustomerDetailProps) {
  const { notify } = useToast()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    first_name: customer.first_name ?? '',
    last_name: customer.last_name ?? '',
    phone: customer.phone ?? '',
  })

  // Fetch customer orders from Medusa API using their email
  const { data, isLoading, isError, error } = useQuery<OrdersResponse>({
    queryKey: ['customer-orders', customer.id],
    queryFn: () =>
      api.get<OrdersResponse>('/admin/orders', {
        q: customer.email,
        limit: 50,
      }),
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      api.post(`/admin/customers/${customer.id}`, {
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
      }),
    onSuccess: () => {
      notify('Müşteri bilgileri güncellendi.')
      qc.invalidateQueries({ queryKey: ['customers'] })
      setEditing(false)
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const orders = data?.orders ?? []

  return (
    <Modal title="Müşteri Detayı" onClose={onClose} size="lg">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        {/* Edit toolbar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {editing ? (
            <>
              <button className="btn btn--secondary btn--sm" disabled={updateMutation.isPending} onClick={() => { setEditing(false); setForm({ first_name: customer.first_name ?? '', last_name: customer.last_name ?? '', phone: customer.phone ?? '' }) }}>
                <X size={14} /> Vazgeç
              </button>
              <button className="btn btn--primary btn--sm" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
                {updateMutation.isPending ? <Spinner size={14} /> : <Save size={14} />} Kaydet
              </button>
            </>
          ) : (
            <button className="btn btn--secondary btn--sm" onClick={() => setEditing(true)}>
              <Pencil size={14} /> Bilgileri Düzenle
            </button>
          )}
        </div>
        {/* Customer Profile Info */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            background: 'var(--bg-secondary)',
            padding: '20px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-primary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--accent-primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}
            >
              <User size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Ad Soyad</div>
              {editing ? (
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <input type="text" placeholder="Ad" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} style={{ width: '50%' }} />
                  <input type="text" placeholder="Soyad" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} style={{ width: '50%' }} />
                </div>
              ) : (
                <div style={{ fontWeight: 600 }}>
                  {customer.first_name || customer.last_name
                    ? `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim()
                    : 'İsimsiz Müşteri'}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--accent-info-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-info)',
              }}
            >
              <Mail size={20} />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>E-posta</div>
              <div style={{ fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {customer.email}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--accent-success-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-success)',
              }}
            >
              <Phone size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Telefon</div>
              {editing ? (
                <input type="text" placeholder="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ width: '100%', marginTop: 4 }} />
              ) : (
                <div style={{ fontWeight: 600 }}>{customer.phone || '—'}</div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--accent-warning-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-warning)',
              }}
            >
              <Calendar size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Kayıt Tarihi</div>
              <div style={{ fontWeight: 600 }}>
                {customer.created_at ? formatDate(customer.created_at) : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Order History */}
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingBag size={18} /> Sipariş Geçmişi
          </h3>

          {isLoading ? (
            <LoadingState label="Siparişler yükleniyor..." />
          ) : isError ? (
            <ErrorState message={(error as Error)?.message} />
          ) : orders.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                border: '1px dashed var(--border-primary)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-tertiary)',
              }}
            >
              Bu müşteriye ait sipariş bulunamadı.
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Sipariş</th>
                    <th>Tarih</th>
                    <th>Durum</th>
                    <th>Toplam</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <strong>#{o.display_id}</strong>
                      </td>
                      <td className="muted" style={{ fontSize: '0.82rem' }}>
                        {formatDate(o.created_at)}
                      </td>
                      <td>
                        <Badge status={orderStatus(o.status)} />
                      </td>
                      <td>{formatMoney(o.total, o.currency_code)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
