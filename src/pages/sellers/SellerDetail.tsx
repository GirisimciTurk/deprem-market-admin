import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  ArrowLeft,
  Store,
  Home,
  Star,
  Percent,
  Wallet,
  Package,
  ShoppingBag,
  Undo2,
  MessageSquare,
  Check,
  Ban,
  AlertTriangle,
  Trash2,
  ExternalLink,
  Info,
} from 'lucide-react'
import Header from '../../components/layout/Header'
import Badge from '../../components/ui/Badge'
import Pagination from '../../components/ui/Pagination'
import { LoadingState } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/StateBox'
import { useToast } from '../../components/ui/toast-context'
import { api } from '../../lib/api'
import { formatMoney, formatDate } from '../../lib/format'
import type { StatusMeta } from '../../lib/statusLabels'

type SellerStatus = 'pending' | 'active' | 'suspended'
type CarrierCode = 'aras' | 'yurtici' | 'mng' | 'ptt'

const CARRIERS: { code: CarrierCode; label: string }[] = [
  { code: 'aras', label: 'Aras Kargo' },
  { code: 'yurtici', label: 'Yurtiçi Kargo' },
  { code: 'mng', label: 'MNG Kargo' },
  { code: 'ptt', label: 'PTT Kargo' },
]

interface Seller {
  id: string
  handle: string
  name: string
  legal_name: string | null
  email: string | null
  phone: string | null
  description: string | null
  logo: string | null
  status: SellerStatus
  commission_rate: number
  tax_number: string | null
  iban: string | null
  account_holder: string | null
  default_carrier: CarrierCode | null
  is_house: boolean
  rating_sum: number
  rating_count: number
  created_at: string
}

interface SellerProduct {
  id: string
  title: string
  handle: string
  status: string
  thumbnail: string | null
  created_at: string
}

interface SellerReturnRow {
  id: string
  display_id: string | null
  customer_email: string | null
  currency_code: string
  status: 'requested' | 'received'
  reason: string | null
  returned_subtotal: number
  returned_earning: number
  created_at: string
}

interface SellerDetailResponse {
  seller: Seller
  product_stats: { total: number; published: number; proposed: number; rejected: number }
  order_stats: {
    count: number
    fulfilled_count: number
    pending_ship_count: number
    gross: number
    commission: number
    earning_net: number
  }
  payout: {
    currency_code: string
    pending_balance: number
    eligible_balance: number
    paid_total: number
    total_returned: number
  }
  return_stats: { count: number; requested_count: number; returned_subtotal: number }
  review_stats: { rating_avg: number | null; rating_count: number; pending_count: number }
  products: SellerProduct[]
  recent_returns: SellerReturnRow[]
}

function statusBadge(status: SellerStatus): StatusMeta {
  if (status === 'active') return { label: 'Aktif', variant: 'success' }
  if (status === 'suspended') return { label: 'Askıda', variant: 'danger' }
  return { label: 'Beklemede', variant: 'warning' }
}

function productStatusBadge(status: string): StatusMeta {
  if (status === 'published') return { label: 'Yayında', variant: 'success' }
  if (status === 'proposed' || status === 'draft') return { label: 'Onay Bekliyor', variant: 'warning' }
  if (status === 'rejected') return { label: 'Reddedildi', variant: 'danger' }
  return { label: status, variant: 'neutral' }
}

type Tab = 'overview' | 'settings' | 'orders' | 'products' | 'reviews' | 'returns'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Genel Bakış', icon: <Store size={15} /> },
  { id: 'settings', label: 'Bilgiler & Ayarlar', icon: <Info size={15} /> },
  { id: 'orders', label: 'Siparişler & Ödeme', icon: <Wallet size={15} /> },
  { id: 'products', label: 'Ürünler', icon: <Package size={15} /> },
  { id: 'reviews', label: 'Değerlendirmeler', icon: <Star size={15} /> },
  { id: 'returns', label: 'İadeler', icon: <Undo2 size={15} /> },
]

export default function SellerDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { notify } = useToast()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('overview')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['seller-detail', id],
    queryFn: () => api.get<SellerDetailResponse>(`/admin/sellers/${id}`),
    enabled: !!id,
  })

  const statusMutation = useMutation({
    mutationFn: (status: SellerStatus) => api.post(`/admin/sellers/${id}`, { status }),
    onSuccess: (_r, status) => {
      notify(status === 'active' ? 'Satıcı aktifleştirildi.' : status === 'suspended' ? 'Satıcı askıya alındı.' : 'Güncellendi.')
      qc.invalidateQueries({ queryKey: ['seller-detail', id] })
      qc.invalidateQueries({ queryKey: ['sellers'] })
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  if (isLoading) {
    return (
      <>
        <Header title="Satıcı Detayı" subtitle="Yükleniyor..." />
        <div style={{ padding: '24px' }}><LoadingState label="Satıcı verisi yükleniyor..." /></div>
      </>
    )
  }
  if (isError || !data) {
    return (
      <>
        <Header title="Satıcı Detayı" />
        <div style={{ padding: '24px' }}>
          <button className="btn btn--secondary" onClick={() => navigate('/sellers')} style={{ marginBottom: 16 }}>
            <ArrowLeft size={16} /> Satıcılara Dön
          </button>
          <ErrorState message={(error as Error)?.message || 'Satıcı yüklenemedi.'} onRetry={() => refetch()} />
        </div>
      </>
    )
  }

  const s = data.seller
  const cur = data.payout.currency_code
  const rating = data.review_stats.rating_avg

  return (
    <>
      <Header title={s.name} subtitle={`Satıcı yönetimi · /${s.handle}`} />

      <div style={{ padding: '24px' }}>
        {/* Back + identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button className="btn btn--secondary btn--sm" onClick={() => navigate('/sellers')}>
            <ArrowLeft size={15} /> Satıcılar
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            }}>
              {s.logo ? <img src={s.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : s.is_house ? <Home size={20} className="muted" /> : <Store size={20} className="muted" />}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {s.name}
                <Badge status={statusBadge(s.status)} />
                {s.is_house && <Badge status={{ label: 'Ana Mağaza', variant: 'info' }} />}
              </div>
              <div className="muted" style={{ fontSize: '0.8rem' }}>
                {rating != null ? <><Star size={11} style={{ fill: 'var(--accent-warning)', color: 'var(--accent-warning)', verticalAlign: 'middle' }} /> {rating.toFixed(1)} ({data.review_stats.rating_count}) · </> : ''}
                Komisyon %{s.commission_rate} · Kayıt {formatDate(s.created_at)}
              </div>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            {s.status !== 'active' && (
              <button className="btn btn--primary btn--sm" onClick={() => statusMutation.mutate('active')} disabled={statusMutation.isPending}>
                <Check size={15} /> Aktifleştir
              </button>
            )}
            {s.status === 'active' && !s.is_house && (
              <button className="btn btn--secondary btn--sm" style={{ color: 'var(--accent-warning)' }}
                onClick={() => { if (window.confirm('Satıcıyı askıya almak istediğinize emin misiniz? Satışları durur.')) statusMutation.mutate('suspended') }}
                disabled={statusMutation.isPending}>
                <Ban size={15} /> Askıya Al
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-primary)', marginBottom: '24px', flexWrap: 'wrap' }}>
          {TABS.map((t) => {
            const badgeCount = t.id === 'reviews' ? data.review_stats.pending_count
              : t.id === 'returns' ? data.return_stats.requested_count
              : t.id === 'products' ? data.product_stats.proposed : 0
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="btn btn--ghost"
                style={{
                  borderRadius: 0,
                  borderBottom: tab === t.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  color: tab === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: tab === t.id ? 600 : 500,
                  padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                {t.icon} {t.label}
                {badgeCount > 0 && (
                  <span style={{
                    background: 'var(--accent-warning)', color: '#000', borderRadius: '999px',
                    fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', minWidth: 16, textAlign: 'center',
                  }}>{badgeCount}</span>
                )}
              </button>
            )
          })}
        </div>

        {tab === 'overview' && <OverviewTab data={data} cur={cur} />}
        {tab === 'settings' && <SettingsTab seller={s} onSaved={() => { qc.invalidateQueries({ queryKey: ['seller-detail', id] }); qc.invalidateQueries({ queryKey: ['sellers'] }) }} />}
        {tab === 'orders' && <OrdersTab sellerId={id} sellerName={s.name} />}
        {tab === 'products' && <ProductsTab products={data.products} />}
        {tab === 'reviews' && <ReviewsTab sellerId={id} />}
        {tab === 'returns' && <ReturnsTab returns={data.recent_returns} />}
      </div>
    </>
  )
}

/* ---------- Overview ---------- */

function OverviewTab({ data, cur }: { data: SellerDetailResponse; cur: string }) {
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

function Kpi({ icon, label, value, sub, highlight }: { icon?: React.ReactNode; label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? 'var(--accent-primary-light, var(--bg-tertiary))' : 'var(--bg-secondary)',
      border: highlight ? '1px solid var(--accent-primary)' : '1px solid var(--border-primary)',
      borderRadius: 'var(--radius-md)', padding: '14px 16px',
    }}>
      <div className="muted" style={{ fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {icon}{label}
      </div>
      <div style={{ fontWeight: 700, fontSize: '1.15rem', marginTop: '6px', color: highlight ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: '0.74rem', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

/* ---------- Settings ---------- */

interface SettingsForm {
  name: string
  legal_name: string
  email: string
  phone: string
  description: string
  logo: string
  tax_number: string
  iban: string
  account_holder: string
  default_carrier: '' | CarrierCode
  commission_rate: number
  status: SellerStatus
}

function SettingsTab({ seller, onSaved }: { seller: Seller; onSaved: () => void }) {
  const { notify } = useToast()
  const [form, setForm] = useState<SettingsForm>({
    name: seller.name,
    legal_name: seller.legal_name ?? '',
    email: seller.email ?? '',
    phone: seller.phone ?? '',
    description: seller.description ?? '',
    logo: seller.logo ?? '',
    tax_number: seller.tax_number ?? '',
    iban: seller.iban ?? '',
    account_holder: seller.account_holder ?? '',
    default_carrier: (seller.default_carrier ?? '') as '' | CarrierCode,
    commission_rate: seller.commission_rate,
    status: seller.status,
  })

  const save = useMutation({
    mutationFn: () =>
      api.post(`/admin/sellers/${seller.id}`, {
        name: form.name.trim(),
        legal_name: form.legal_name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        description: form.description.trim() || null,
        logo: form.logo.trim() || null,
        tax_number: form.tax_number.trim() || null,
        iban: form.iban.trim() || null,
        account_holder: form.account_holder.trim() || null,
        default_carrier: form.default_carrier || null,
        commission_rate: Number(form.commission_rate),
        status: form.status,
      }),
    onSuccess: () => { notify('Satıcı bilgileri kaydedildi.'); onSaved() },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  function set<K extends keyof SettingsForm>(k: K, v: SettingsForm[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: 880 }}>
      <Section title="Mağaza Bilgileri">
        <Grid>
          <Field label="Satıcı Adı *"><input value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Yasal Unvan"><input value={form.legal_name} onChange={(e) => set('legal_name', e.target.value)} placeholder="Ticari unvan" /></Field>
          <Field label="E-posta"><input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Telefon"><input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="05XX XXX XX XX" /></Field>
          <Field label="Logo URL"><input value={form.logo} onChange={(e) => set('logo', e.target.value)} placeholder="https://..." /></Field>
          <Field label="Durum">
            <select value={form.status} onChange={(e) => set('status', e.target.value as SellerStatus)}>
              <option value="pending">Beklemede</option>
              <option value="active">Aktif</option>
              <option value="suspended">Askıda</option>
            </select>
          </Field>
        </Grid>
        <Field label="Mağaza Açıklaması">
          <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Mağaza hakkında kısa tanıtım..." />
        </Field>
      </Section>

      <Section title="Komisyon & Kargo">
        <Grid>
          <Field label="Sabit Komisyon Oranı (%)">
            <input type="number" min={0} max={100} value={form.commission_rate}
              onChange={(e) => set('commission_rate', Number(e.target.value))} />
          </Field>
          <Field label="Varsayılan Kargo Firması">
            <select value={form.default_carrier} onChange={(e) => set('default_carrier', e.target.value as '' | CarrierCode)}>
              <option value="">Seçilmedi</option>
              {CARRIERS.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </Field>
        </Grid>
        <p className="muted" style={{ fontSize: '0.78rem', marginTop: '-4px' }}>
          Kategori bazlı komisyon kuralı olan ürünlerde o kural önceliklidir; kural yoksa bu sabit oran uygulanır.
        </p>
      </Section>

      <Section title="Ödeme / Fatura Bilgileri">
        <Grid>
          <Field label="Vergi / TC No"><input value={form.tax_number} onChange={(e) => set('tax_number', e.target.value)} /></Field>
          <Field label="IBAN"><input value={form.iban} onChange={(e) => set('iban', e.target.value)} placeholder="TR.." /></Field>
          <Field label="Hesap Sahibi"><input value={form.account_holder} onChange={(e) => set('account_holder', e.target.value)} /></Field>
        </Grid>
      </Section>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn--primary" onClick={() => { if (!form.name.trim()) { notify('Satıcı adı zorunludur.', 'error'); return } save.mutate() }} disabled={save.isPending}>
          {save.isPending ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
        </button>
      </div>
    </div>
  )
}

/* ---------- Orders & Payout ---------- */

const ORDER_LIMIT = 20

interface SellerOrderRow {
  id: string
  display_id: number
  currency_code: string
  subtotal: number
  commission_amount: number
  seller_earning: number
  item_count: number
  fulfillment_status: string
  payout_status: string
  carrier: string | null
  tracking_number: string | null
  tracking_url: string | null
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

function OrdersTab({ sellerId, sellerName }: { sellerId: string; sellerName: string }) {
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

/* ---------- Products ---------- */

function ProductsTab({ products }: { products: SellerProduct[] }) {
  if (products.length === 0) {
    return <div className="card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>Bu satıcının ürünü yok.</div>
  }
  return (
    <div className="table-container animate-fadeIn">
      <table>
        <thead><tr><th>Ürün</th><th>Durum</th><th>Eklenme</th><th style={{ textAlign: 'right' }}>İşlem</th></tr></thead>
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
              <td style={{ textAlign: 'right' }}>
                <Link to={`/products/${p.id}`} className="btn btn--secondary btn--icon btn--sm" title="Ürünü Düzenle"><ExternalLink size={14} /></Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ---------- Reviews ---------- */

interface SellerReviewRow {
  id: string
  rating: number
  comment: string
  status: 'pending' | 'approved' | 'spam'
  customer_name: string
  created_at: string
}

const REVIEW_LIMIT = 20

function reviewBadge(status: string): StatusMeta {
  if (status === 'approved') return { label: 'Onaylı', variant: 'success' }
  if (status === 'spam') return { label: 'Spam', variant: 'danger' }
  return { label: 'Beklemede', variant: 'warning' }
}

function ReviewsTab({ sellerId }: { sellerId: string }) {
  const { notify } = useToast()
  const qc = useQueryClient()
  const [offset, setOffset] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['seller-reviews-detail', sellerId, statusFilter, offset],
    queryFn: () => api.get<{ reviews: SellerReviewRow[]; count: number }>('/admin/seller-reviews', {
      seller_id: sellerId, status: statusFilter || undefined, limit: REVIEW_LIMIT, offset,
    }),
    placeholderData: keepPreviousData,
  })
  const reviews = data?.reviews ?? []

  const statusM = useMutation({
    mutationFn: ({ rid, status }: { rid: string; status: string }) => api.post(`/admin/seller-reviews/${rid}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seller-reviews-detail', sellerId] })
      qc.invalidateQueries({ queryKey: ['seller-detail', sellerId] })
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })
  const delM = useMutation({
    mutationFn: (rid: string) => api.delete(`/admin/seller-reviews/${rid}`),
    onSuccess: () => { notify('Değerlendirme silindi.'); qc.invalidateQueries({ queryKey: ['seller-reviews-detail', sellerId] }); qc.invalidateQueries({ queryKey: ['seller-detail', sellerId] }) },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setOffset(0) }} style={{ width: 'auto', minWidth: 180 }}>
          <option value="">Tüm Durumlar</option>
          <option value="pending">Onay Bekleyenler</option>
          <option value="approved">Onaylananlar</option>
          <option value="spam">Spam</option>
        </select>
      </div>

      {isLoading ? <LoadingState />
        : isError ? <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        : reviews.length === 0 ? (
          <div className="card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
            <MessageSquare size={24} style={{ marginBottom: 8, opacity: 0.6 }} />
            <div>Değerlendirme bulunamadı.</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: isFetching ? 0.7 : 1 }}>
              {reviews.map((r) => (
                <div key={r.id} className="card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{r.customer_name}</span>
                        <span style={{ color: 'var(--accent-warning)', fontSize: '0.85rem' }}>{'★'.repeat(r.rating)}<span className="muted">{'★'.repeat(5 - r.rating)}</span></span>
                        <Badge status={reviewBadge(r.status)} />
                      </div>
                      <div style={{ fontSize: '0.88rem', color: r.status === 'spam' ? 'var(--accent-danger)' : 'var(--text-primary)', textDecoration: r.status === 'spam' ? 'line-through' : 'none' }}>{r.comment}</div>
                      <div className="muted" style={{ fontSize: '0.74rem', marginTop: '6px' }}>{new Date(r.created_at).toLocaleDateString('tr-TR')}</div>
                    </div>
                    <div className="row-actions">
                      {r.status !== 'approved' && (
                        <button className="btn btn--secondary btn--icon btn--sm" style={{ color: 'var(--accent-success)' }} title="Onayla" onClick={() => statusM.mutate({ rid: r.id, status: 'approved' })}><Check size={14} /></button>
                      )}
                      {r.status !== 'spam' && (
                        <button className="btn btn--secondary btn--icon btn--sm" style={{ color: 'var(--accent-warning)' }} title="Spam" onClick={() => statusM.mutate({ rid: r.id, status: 'spam' })}><AlertTriangle size={14} /></button>
                      )}
                      <button className="btn btn--danger btn--icon btn--sm" title="Sil" onClick={() => { if (window.confirm('Bu değerlendirmeyi silmek istediğinize emin misiniz?')) delM.mutate(r.id) }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Pagination offset={offset} limit={REVIEW_LIMIT} count={data?.count ?? 0} onChange={setOffset} />
          </>
        )}
    </div>
  )
}

/* ---------- Returns ---------- */

function returnBadge(status: string): StatusMeta {
  if (status === 'received') return { label: 'Teslim Alındı', variant: 'success' }
  return { label: 'Talep Edildi', variant: 'warning' }
}

function ReturnsTab({ returns }: { returns: SellerReturnRow[] }) {
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

/* ---------- shared layout helpers ---------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: '20px' }}>
      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '16px' }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>{children}</div>
    </div>
  )
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>{children}</div>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
      {children}
    </label>
  )
}
