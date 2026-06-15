import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  Store,
  Search,
  Plus,
  Pencil,
  Check,
  Ban,
  Trash2,
  Percent,
  Home,
  Wallet,
  Star,
  ArrowRight,
} from 'lucide-react'
import Header from '../../components/layout/Header'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import { CarrierLogo } from '../../components/ui/CarrierLogo'
import Pagination from '../../components/ui/Pagination'
import { LoadingState } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/StateBox'
import { useToast } from '../../components/ui/toast-context'
import { useDebounce } from '../../lib/useDebounce'
import { api } from '../../lib/api'
import { formatMoney } from '../../lib/format'
import type { StatusMeta } from '../../lib/statusLabels'

const LIMIT = 20

type SellerStatus = 'pending' | 'active' | 'suspended'

interface Seller {
  id: string
  handle: string
  name: string
  legal_name: string | null
  email: string | null
  phone: string | null
  status: SellerStatus
  commission_rate: number
  tax_number: string | null
  iban: string | null
  account_holder: string | null
  is_house: boolean
  rating_sum?: number
  rating_count?: number
  created_at: string
}

function sellerRating(s: Seller): { avg: number; count: number } | null {
  const count = s.rating_count ?? 0
  if (count <= 0) return null
  const sum = s.rating_sum ?? 0
  return { avg: Math.round((sum / count) * 10) / 10, count }
}

interface SellerForm {
  name: string
  legal_name: string
  email: string
  phone: string
  tax_number: string
  iban: string
  account_holder: string
  commission_rate: number
  status: SellerStatus
}

const EMPTY_FORM: SellerForm = {
  name: '',
  legal_name: '',
  email: '',
  phone: '',
  tax_number: '',
  iban: '',
  account_holder: '',
  commission_rate: 10,
  status: 'active',
}

function statusBadge(status: SellerStatus) {
  if (status === 'active') return { label: 'Aktif', variant: 'success' as const }
  if (status === 'suspended') return { label: 'Askıda', variant: 'danger' as const }
  return { label: 'Beklemede', variant: 'warning' as const }
}

export default function Sellers() {
  const { notify } = useToast()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [editing, setEditing] = useState<Seller | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<SellerForm>(EMPTY_FORM)
  const [payoutSeller, setPayoutSeller] = useState<Seller | null>(null)
  const debounced = useDebounce(search)

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['sellers', offset, debounced, statusFilter],
    queryFn: () =>
      api.get<{ sellers: Seller[]; count: number }>('/admin/sellers', {
        limit: LIMIT,
        offset,
        q: debounced || undefined,
        status: statusFilter || undefined,
      }),
    placeholderData: keepPreviousData,
  })
  const sellers = data?.sellers ?? []

  const saveMutation = useMutation({
    mutationFn: (payload: { id?: string; body: Partial<SellerForm> }) =>
      payload.id
        ? api.post(`/admin/sellers/${payload.id}`, payload.body)
        : api.post('/admin/sellers', payload.body),
    onSuccess: (_r, vars) => {
      notify(vars.id ? 'Satıcı güncellendi.' : 'Satıcı oluşturuldu.')
      qc.invalidateQueries({ queryKey: ['sellers'] })
      closeForm()
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SellerStatus }) =>
      api.post(`/admin/sellers/${id}`, { status }),
    onSuccess: (_r, vars) => {
      notify(vars.status === 'active' ? 'Satıcı aktifleştirildi.' : 'Satıcı askıya alındı.')
      qc.invalidateQueries({ queryKey: ['sellers'] })
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/sellers/${id}`),
    onSuccess: () => {
      notify('Satıcı silindi.')
      qc.invalidateQueries({ queryKey: ['sellers'] })
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setCreating(true)
  }

  function openEdit(s: Seller) {
    setCreating(false)
    setEditing(s)
    setForm({
      name: s.name,
      legal_name: s.legal_name ?? '',
      email: s.email ?? '',
      phone: s.phone ?? '',
      tax_number: s.tax_number ?? '',
      iban: s.iban ?? '',
      account_holder: s.account_holder ?? '',
      commission_rate: s.commission_rate,
      status: s.status,
    })
  }

  function closeForm() {
    setCreating(false)
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      notify('Satıcı adı zorunludur.', 'error')
      return
    }
    const body: Partial<SellerForm> = {
      name: form.name.trim(),
      legal_name: form.legal_name.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      tax_number: form.tax_number.trim() || undefined,
      iban: form.iban.trim() || undefined,
      account_holder: form.account_holder.trim() || undefined,
      commission_rate: Number(form.commission_rate),
      status: form.status,
    }
    saveMutation.mutate({ id: editing?.id, body })
  }

  function handleSuspend(s: Seller) {
    if (window.confirm(`"${s.name}" satıcısını askıya almak istediğinize emin misiniz? Satışları durur.`)) {
      statusMutation.mutate({ id: s.id, status: 'suspended' })
    }
  }

  function handleDelete(s: Seller) {
    if (window.confirm(`"${s.name}" satıcısını kalıcı olarak silmek istediğinize emin misiniz?`)) {
      deleteMutation.mutate(s.id)
    }
  }

  const formOpen = creating || !!editing

  return (
    <>
      <Header title="Satıcılar" subtitle="Pazar yerindeki bayileri yönetin, komisyon ve durumlarını düzenleyin" />

      <div style={{ padding: '24px' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div className="header__search" style={{ flex: 1, minWidth: '220px' }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Satıcı adı, e-posta veya unvan ara..."
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
            style={{ width: 'auto', minWidth: '160px' }}
          >
            <option value="">Tüm Durumlar</option>
            <option value="pending">Beklemede</option>
            <option value="active">Aktif</option>
            <option value="suspended">Askıda</option>
          </select>
          <button className="btn btn--primary" onClick={openCreate}>
            <Plus size={16} /> Satıcı Ekle
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <LoadingState label="Satıcılar yükleniyor..." />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : sellers.length === 0 ? (
          <EmptyState
            icon={<Store size={26} />}
            title="Satıcı bulunamadı"
            description={search || statusFilter ? 'Filtreye uygun satıcı yok.' : 'Henüz satıcı eklenmemiş. "Satıcı Ekle" ile başlayın.'}
          />
        ) : (
          <>
            <div className="table-container animate-fadeIn" style={{ opacity: isFetching ? 0.7 : 1 }}>
              <table>
                <thead>
                  <tr>
                    <th>Satıcı</th>
                    <th>İletişim</th>
                    <th>Komisyon</th>
                    <th>Puan</th>
                    <th>Durum</th>
                    <th style={{ textAlign: 'right' }}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {sellers.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div>
                          <Link
                            to={`/sellers/${s.id}`}
                            style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', color: 'inherit' }}
                            className="seller-name-link"
                          >
                            {s.is_house ? <Home size={14} className="muted" /> : <Store size={14} className="muted" />}
                            {s.name}
                            {s.is_house && <Badge status={{ label: 'Ana Mağaza', variant: 'info' }} />}
                          </Link>
                          <div className="muted" style={{ fontSize: '0.78rem', marginTop: '2px' }}>
                            /{s.handle}{s.tax_number ? ` · VKN: ${s.tax_number}` : ''}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem' }}>
                          <div>{s.email || <span className="muted">—</span>}</div>
                          <div className="muted" style={{ fontSize: '0.78rem' }}>{s.phone || ''}</div>
                        </div>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem' }}>
                          <Percent size={13} className="muted" /> %{s.commission_rate}
                        </span>
                      </td>
                      <td>
                        {(() => {
                          const r = sellerRating(s)
                          return r ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem' }}>
                              <Star size={13} style={{ fill: 'var(--accent-warning)', color: 'var(--accent-warning)' }} />
                              {r.avg.toFixed(1)} <span className="muted">({r.count})</span>
                            </span>
                          ) : (
                            <span className="muted" style={{ fontSize: '0.85rem' }}>—</span>
                          )
                        })()}
                      </td>
                      <td>
                        <Badge status={statusBadge(s.status)} />
                      </td>
                      <td>
                        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn--primary btn--sm"
                            title="Detaylı Yönetim"
                            onClick={() => navigate(`/sellers/${s.id}`)}
                          >
                            Detay <ArrowRight size={13} />
                          </button>
                          <button
                            className="btn btn--secondary btn--icon btn--sm"
                            title="Ödemeler / Siparişler"
                            onClick={() => setPayoutSeller(s)}
                          >
                            <Wallet size={14} />
                          </button>
                          <button
                            className="btn btn--secondary btn--icon btn--sm"
                            title="Düzenle"
                            onClick={() => openEdit(s)}
                          >
                            <Pencil size={14} />
                          </button>
                          {s.status !== 'active' && (
                            <button
                              className="btn btn--secondary btn--icon btn--sm"
                              style={{ color: 'var(--accent-success)' }}
                              title="Aktifleştir"
                              onClick={() => statusMutation.mutate({ id: s.id, status: 'active' })}
                            >
                              <Check size={14} />
                            </button>
                          )}
                          {s.status === 'active' && !s.is_house && (
                            <button
                              className="btn btn--secondary btn--icon btn--sm"
                              style={{ color: 'var(--accent-warning)' }}
                              title="Askıya Al"
                              onClick={() => handleSuspend(s)}
                            >
                              <Ban size={14} />
                            </button>
                          )}
                          {!s.is_house && (
                            <button
                              className="btn btn--secondary btn--icon btn--sm"
                              style={{ color: 'var(--accent-danger)' }}
                              title="Sil"
                              onClick={() => handleDelete(s)}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
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

      {/* Create / Edit Modal */}
      {formOpen && (
        <Modal
          title={editing ? `Satıcıyı Düzenle: ${editing.name}` : 'Yeni Satıcı'}
          onClose={closeForm}
          size="lg"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn--secondary" onClick={closeForm}>İptal</button>
              <button className="btn btn--primary" onClick={handleSubmit} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <Field label="Satıcı Adı *">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Görünen ad" />
            </Field>
            <Field label="Yasal Unvan">
              <input value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} placeholder="Ticari unvan" />
            </Field>
            <Field label="E-posta">
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ornek@firma.com" />
            </Field>
            <Field label="Telefon">
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="05XX XXX XX XX" />
            </Field>
            <Field label="Vergi / TC No">
              <input value={form.tax_number} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} />
            </Field>
            <Field label="Komisyon (%)">
              <input
                type="number"
                min={0}
                max={100}
                value={form.commission_rate}
                onChange={(e) => setForm({ ...form, commission_rate: Number(e.target.value) })}
              />
            </Field>
            <Field label="IBAN">
              <input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} placeholder="TR.." />
            </Field>
            <Field label="Hesap Sahibi">
              <input value={form.account_holder} onChange={(e) => setForm({ ...form, account_holder: e.target.value })} />
            </Field>
            <Field label="Durum">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as SellerStatus })}>
                <option value="pending">Beklemede</option>
                <option value="active">Aktif</option>
                <option value="suspended">Askıda</option>
              </select>
            </Field>
          </div>
        </Modal>
      )}

      {/* Payout / Orders Modal */}
      {payoutSeller && (
        <PayoutModal seller={payoutSeller} onClose={() => setPayoutSeller(null)} />
      )}
    </>
  )
}

const PAYOUT_LIMIT = 20

interface SellerOrder {
  id: string
  display_id: number
  customer_email: string | null
  currency_code: string
  subtotal: number
  commission_rate: number
  commission_amount: number
  seller_earning: number
  item_count: number
  items: unknown
  fulfillment_status: string
  payout_status: string
  carrier: string | null
  tracking_number: string | null
  tracking_url: string | null
  paid_at: string | null
  created_at: string
}

interface PayoutSummary {
  currency_code: string
  total_earning: number
  total_commission: number
  total_returned?: number
  pending_balance: number
  eligible_balance: number
  paid_total: number
}

interface SellerOrdersResponse {
  orders: SellerOrder[]
  count: number
  offset: number
  limit: number
  summary: PayoutSummary
}

function payoutStatusBadge(status: string): StatusMeta {
  if (status === 'paid') return { label: 'Ödendi', variant: 'success' }
  if (status === 'eligible') return { label: 'Ödenebilir', variant: 'info' }
  return { label: 'Hakediş Bekliyor', variant: 'warning' }
}

function fulfillmentStatusBadge(status: string): StatusMeta {
  if (status === 'fulfilled') return { label: 'Kargolandı', variant: 'success' }
  if (status === 'canceled') return { label: 'İptal', variant: 'danger' }
  return { label: 'Hazırlanıyor', variant: 'warning' }
}

function PayoutModal({ seller, onClose }: { seller: Seller; onClose: () => void }) {
  const { notify } = useToast()
  const qc = useQueryClient()
  const [offset, setOffset] = useState(0)
  const [payoutFilter, setPayoutFilter] = useState<string>('')

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['seller-orders', seller.id, payoutFilter, offset],
    queryFn: () =>
      api.get<SellerOrdersResponse>(`/admin/sellers/${seller.id}/orders`, {
        payout: payoutFilter || undefined,
        limit: PAYOUT_LIMIT,
        offset,
      }),
    placeholderData: keepPreviousData,
  })

  const orders = data?.orders ?? []
  const summary = data?.summary
  const eligibleBalance = summary?.eligible_balance ?? 0
  const pendingBalance = summary?.pending_balance ?? 0
  const currency = summary?.currency_code

  const payoutMutation = useMutation({
    mutationFn: () =>
      api.post<{ paid_count: number; paid_amount?: number; message?: string }>(`/admin/sellers/${seller.id}/payout`, {}),
    onSuccess: (r) => {
      if (r.paid_count > 0) {
        notify(`${r.paid_count} sipariş ödendi (${formatMoney(r.paid_amount, currency)}).`)
      } else {
        notify(r.message || 'Ödenebilir sipariş bulunmuyor.')
      }
      qc.invalidateQueries({ queryKey: ['seller-orders', seller.id] })
      qc.invalidateQueries({ queryKey: ['sellers'] })
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const settleMutation = useMutation({
    mutationFn: () => api.post<{ ok: boolean; settled: number; hakedis_days: number }>('/admin/settle-payouts', {}),
    onSuccess: (r) => {
      notify(`${r.settled} sipariş hakediş etti (${r.hakedis_days} gün).`)
      qc.invalidateQueries({ queryKey: ['seller-orders'] })
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  function handlePayout() {
    if (eligibleBalance <= 0) return
    if (window.confirm(`"${seller.name}" için ödenebilir tüm siparişleri ödendi olarak işaretlemek istediğinize emin misiniz?`)) {
      payoutMutation.mutate()
    }
  }

  return (
    <Modal title={`Ödemeler / Siparişler: ${seller.name}`} onClose={onClose} size="lg">
      {/* Summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <SummaryCard label="Toplam Kazanç" value={formatMoney(summary?.total_earning, currency)} />
        <SummaryCard label="Toplam Komisyon" value={formatMoney(summary?.total_commission, currency)} />
        <SummaryCard label="İade Edilen" value={formatMoney(summary?.total_returned ?? 0, currency)} />
        <SummaryCard label="Ödenen" value={formatMoney(summary?.paid_total, currency)} />
        <SummaryCard label="Hakediş Bekleyen" value={formatMoney(pendingBalance, currency)} />
        <SummaryCard label="Ödenebilir Bakiye" value={formatMoney(eligibleBalance, currency)} highlight />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <select
          value={payoutFilter}
          onChange={(e) => {
            setPayoutFilter(e.target.value)
            setOffset(0)
          }}
          style={{ width: 'auto', minWidth: '160px' }}
        >
          <option value="">Tümü</option>
          <option value="pending">Hakediş Bekleyen</option>
          <option value="eligible">Ödenebilir</option>
          <option value="paid">Ödenen</option>
        </select>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="btn btn--secondary"
            onClick={() => settleMutation.mutate()}
            disabled={settleMutation.isPending}
            title="Hakediş süresi dolan kargolanmış siparişleri ödenebilir yapar"
          >
            {settleMutation.isPending ? 'Çalışıyor...' : 'Hakedişi Çalıştır'}
          </button>
          <button
            className="btn btn--primary"
            onClick={handlePayout}
            disabled={eligibleBalance <= 0 || payoutMutation.isPending}
          >
            <Wallet size={16} /> {payoutMutation.isPending ? 'İşleniyor...' : 'Ödenebilirleri Öde'}
          </button>
        </div>
      </div>

      {/* Hakediş note */}
      <p className="muted" style={{ fontSize: '0.78rem', marginBottom: '16px', marginTop: '-4px' }}>
        Kargolanan siparişler hakediş süresi (varsayılan 14 gün) sonunda ödenebilir olur; ödeme yalnız "Ödenebilir" tutar için yapılır.
      </p>

      {/* Content */}
      {isLoading ? (
        <LoadingState label="Siparişler yükleniyor..." />
      ) : isError ? (
        <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
      ) : orders.length === 0 ? (
        <div className="card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
          {payoutFilter ? 'Bu filtreye uygun sipariş yok.' : 'Bu satıcıya ait sipariş bulunmuyor.'}
        </div>
      ) : (
        <>
          <div className="table-container animate-fadeIn" style={{ opacity: isFetching ? 0.7 : 1 }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tarih</th>
                  <th>Adet</th>
                  <th>Ara Toplam</th>
                  <th>Komisyon</th>
                  <th>Kazanç</th>
                  <th>Kargo Durumu</th>
                  <th>Ödeme</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600 }}>#{o.display_id}</td>
                    <td className="muted" style={{ fontSize: '0.82rem' }}>
                      {new Date(o.created_at).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="muted">{o.item_count}</td>
                    <td className="nowrap">{formatMoney(o.subtotal, o.currency_code)}</td>
                    <td className="nowrap">{formatMoney(o.commission_amount, o.currency_code)}</td>
                    <td className="nowrap" style={{ fontWeight: 600 }}>{formatMoney(o.seller_earning, o.currency_code)}</td>
                    <td>
                      <Badge status={fulfillmentStatusBadge(o.fulfillment_status)} />
                      {o.tracking_number && (
                        <div style={{ fontSize: '0.75rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          {o.carrier && <CarrierLogo code={o.carrier} height={14} />}
                          <span className="muted">{o.tracking_number}</span>
                          {o.tracking_url && (
                            <a
                              href={o.tracking_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: 'block', color: 'var(--accent-primary)' }}
                            >
                              Kargom Nerede?
                            </a>
                          )}
                        </div>
                      )}
                    </td>
                    <td><Badge status={payoutStatusBadge(o.payout_status)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination offset={offset} limit={PAYOUT_LIMIT} count={data?.count ?? 0} onChange={setOffset} />
        </>
      )}
    </Modal>
  )
}

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      style={{
        background: highlight ? 'var(--accent-primary-light, var(--bg-tertiary))' : 'var(--bg-secondary)',
        border: highlight ? '1px solid var(--accent-primary)' : '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
      }}
    >
      <div className="muted" style={{ fontSize: '0.76rem' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: '4px', color: highlight ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
      {children}
    </label>
  )
}

function EmptyState({ icon, title, description }: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: '16px', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        {icon}
      </div>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{title}</h3>
      <p style={{ color: 'var(--text-tertiary)', maxWidth: 400, fontSize: '0.9rem' }}>{description}</p>
    </div>
  )
}
