import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  HardHat,
  Eye,
  Phone,
  Mail,
  MapPin,
  Calendar,
  User,
  FileText,
  Store,
  Wand2,
  Wallet,
  ClipboardList,
  Gavel,
} from 'lucide-react'
import Header from '../../components/layout/Header'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import Pagination from '../../components/ui/Pagination'
import { LoadingState } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/StateBox'
import { useToast } from '../../components/ui/toast-context'
import { api } from '../../lib/api'
import {
  serviceRequestStatus,
  servicePaymentStatus,
  serviceOfferDecision,
  servicePayoutStatus,
} from '../../lib/statusLabels'
import { formatLira, formatDate, formatDateShort } from '../../lib/format'

const LIMIT = 20

// ───────────────────────── Tipler ─────────────────────────

type ServiceKind = 'carbon_fiber' | 'panic_room' | 'descent' | 'capsule_bed' | 'gas_cutoff' | 'other'

interface ServiceOfferItem {
  label: string
  qty?: number
  unit_price?: number
  total?: number
}

// Havuz/teklif akışında bayilerin verdiği fiyatlar. price TAM LİRA (major).
interface ServiceBid {
  seller_id: string
  seller_name?: string
  price: number
  note?: string
  created_at?: string
}

interface ServiceRequest {
  id: string
  service_title?: string
  service_kind: ServiceKind
  requires_survey?: boolean
  full_name: string
  email: string
  phone?: string
  city?: string
  district?: string
  address?: string
  details?: Record<string, unknown> | null
  preferred_dates?: string[] | null
  note?: string
  assigned_seller_id?: string | null
  product_id?: string | null
  is_bidding?: boolean
  bids?: ServiceBid[] | null
  survey_scheduled_at?: string | null
  survey_done_at?: string | null
  survey_report?: string
  offer_items?: ServiceOfferItem[] | null
  offer_total?: number | null
  offer_valid_until?: string | null
  offer_sent_at?: string | null
  offer_decision?: 'pending' | 'accepted' | 'rejected'
  survey_fee?: number | null
  deposit_amount?: number | null
  balance_amount?: number | null
  payment_status?: 'none' | 'survey_paid' | 'deposit_paid' | 'paid'
  // ── Tahsilat / escrow / payout (D fazı). Tutarlar TAM LİRA (major). ──
  paid_total?: number | null
  payments?: ServicePayment[] | null
  commission_rate?: number | null
  commission_amount?: number | null
  payout_amount?: number | null
  payout_status?: 'pending' | 'eligible' | 'paid'
  payout_trans_id?: string | null
  paid_at?: string | null
  install_scheduled_at?: string | null
  install_done_at?: string | null
  status: string
  created_at?: string
}

type ServicePhase = 'survey' | 'deposit' | 'balance'

interface ServicePayment {
  phase: ServicePhase
  amount: number
  status: 'pending' | 'paid'
  method?: 'paytr' | 'manual'
  merchant_oid?: string | null
  paid_at?: string
  created_at?: string
}

interface AdminSeller {
  id: string
  name: string
  status?: string
  is_house?: boolean
}

// ───────────────────────── Sabitler ─────────────────────────

const SERVICE_KIND_LABEL: Record<ServiceKind, string> = {
  carbon_fiber: 'Karbon Fiber Güçlendirme',
  panic_room: 'Panik Odası',
  descent: 'Yüksek Kat İniş Aparatı',
  capsule_bed: 'Kapsül Yatak Kiti',
  gas_cutoff: 'Gaz/Elektrik Kesici',
  other: 'Özel Hizmet',
}

const DETAIL_LABELS: Record<string, string> = {
  kat_sayisi: 'Kat Sayısı',
  m2: 'Toplam m²',
  kolon_sayisi: 'Kolon Sayısı',
  bina_yasi: 'Bina Yaşı',
  hedef_kat: 'Hedef Kat',
  tahmini_fiyat_araligi: 'Tahmini Fiyat Aralığı',
}

const prettyKey = (key: string) =>
  DETAIL_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const STATUS_VALUES = [
  'talep', 'kesif_planlandi', 'kesif_yapildi', 'teklif_gonderildi', 'onaylandi',
  'reddedildi', 'tedarik', 'teslim_edildi', 'montaj_planlandi', 'montaj_yapildi',
  'tamamlandi', 'iptal',
]
const PAYMENT_VALUES = ['none', 'survey_paid', 'deposit_paid', 'paid']

// ───────────────────────── Sayfa ─────────────────────────

export default function ServiceRequests() {
  const [offset, setOffset] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const qc = useQueryClient()
  const { notify } = useToast()

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-service-requests', offset, statusFilter],
    queryFn: () =>
      api.get<{ service_requests: ServiceRequest[]; count: number }>('/admin/service-requests', {
        limit: LIMIT,
        offset,
        status: statusFilter || undefined,
      }),
    placeholderData: keepPreviousData,
  })

  // Atama açılır listesi + id→ad eşlemesi için satıcılar.
  const { data: sellersData } = useQuery({
    queryKey: ['admin-sellers-all'],
    queryFn: () => api.get<{ sellers: AdminSeller[] }>('/admin/sellers', { limit: 100 }),
    staleTime: 5 * 60 * 1000,
  })
  const sellers = useMemo(() => sellersData?.sellers ?? [], [sellersData])
  const sellerName = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of sellers) m.set(s.id, s.name)
    return m
  }, [sellers])

  const requests = data?.service_requests ?? []
  const count = data?.count ?? 0
  const selected = requests.find((r) => r.id === selectedId) ?? null

  const mutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown>; msg?: string }) =>
      api.post(`/admin/service-requests/${id}`, body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-service-requests'] })
      notify(vars.msg ?? 'Talep güncellendi.', 'success')
    },
    onError: (e: Error) => notify(e.message || 'İşlem başarısız.', 'error'),
  })

  // Escrow serbest bırakma / bayiye payout (ayrı uç; PayTR transfer veya manuel mod).
  const payoutMutation = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      api.post<{ message?: string }>(`/admin/service-requests/${id}/payout`, {}),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['admin-service-requests'] })
      notify(d?.message ?? 'Bayi ödemesi işlendi.', 'success')
    },
    onError: (e: Error) => notify(e.message || 'Payout başarısız.', 'error'),
  })

  return (
    <div>
      <Header
        title="Hizmet Talepleri"
        subtitle="Tüm keşifli kurulum talepleri — bayi atama, durum ve ödeme yönetimi"
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          className="input"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setOffset(0)
          }}
          style={{ minWidth: 220 }}
        >
          <option value="">Tüm Durumlar</option>
          {STATUS_VALUES.map((v) => (
            <option key={v} value={v}>
              {serviceRequestStatus(v).label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={(error as Error)?.message} onRetry={refetch} />
      ) : requests.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <HardHat size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p>{statusFilter ? 'Bu durumda talep yok.' : 'Henüz hizmet talebi yok.'}</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden', opacity: isFetching ? 0.7 : 1 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Talep</th>
                <th>Hizmet</th>
                <th>Müşteri</th>
                <th>Konum</th>
                <th>Atanan Bayi</th>
                <th>Teklif</th>
                <th>Durum</th>
                <th>Ödeme</th>
                <th>Tarih</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>#{r.id.slice(-6).toUpperCase()}</td>
                  <td style={{ fontSize: 13 }}>{r.service_title || SERVICE_KIND_LABEL[r.service_kind]}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.full_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{r.phone || r.email}</div>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                    {[r.city, r.district].filter(Boolean).join(' / ') || '—'}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {r.assigned_seller_id ? (
                      sellerName.get(r.assigned_seller_id) ?? (
                        <span style={{ color: 'var(--text-tertiary)' }}>#{r.assigned_seller_id.slice(-6)}</span>
                      )
                    ) : (
                      <Badge status={{ variant: 'warning', label: 'Atanmadı' }} />
                    )}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {r.offer_total != null ? formatLira(r.offer_total) : '—'}
                  </td>
                  <td><Badge status={serviceRequestStatus(r.status)} /></td>
                  <td><Badge status={servicePaymentStatus(r.payment_status)} /></td>
                  <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{formatDateShort(r.created_at)}</td>
                  <td>
                    <button className="btn btn--ghost btn--sm" onClick={() => setSelectedId(r.id)} title="Detay & Yönet">
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination offset={offset} limit={LIMIT} count={count} onChange={setOffset} />

      {selected && (
        <RequestDetail
          key={selected.id}
          req={selected}
          sellers={sellers}
          sellerName={sellerName}
          busy={mutation.isPending || payoutMutation.isPending}
          onClose={() => setSelectedId(null)}
          onAction={(body, msg) => mutation.mutate({ id: selected.id, body, msg })}
          onPayout={() => payoutMutation.mutate({ id: selected.id })}
        />
      )}
    </div>
  )
}

// ───────────────────────── Detay & yönetim modalı ─────────────────────────

interface DetailProps {
  req: ServiceRequest
  sellers: AdminSeller[]
  sellerName: Map<string, string>
  busy: boolean
  onClose: () => void
  onAction: (body: Record<string, unknown>, msg?: string) => void
  onPayout: () => void
}

const PHASE_LABEL: Record<ServicePhase, string> = {
  survey: 'Keşif Ücreti',
  deposit: 'Kapora',
  balance: 'Bakiye',
}
const PHASE_FIELD: Record<ServicePhase, 'survey_fee' | 'deposit_amount' | 'balance_amount'> = {
  survey: 'survey_fee',
  deposit: 'deposit_amount',
  balance: 'balance_amount',
}

function RequestDetail({ req, sellers, sellerName, busy, onClose, onAction, onPayout }: DetailProps) {
  const [assignTo, setAssignTo] = useState(req.assigned_seller_id ?? '')
  const [status, setStatus] = useState(req.status)
  const [paymentStatus, setPaymentStatus] = useState<string>(req.payment_status ?? 'none')
  const [surveyFee, setSurveyFee] = useState(req.survey_fee != null ? String(req.survey_fee) : '')
  const [deposit, setDeposit] = useState(req.deposit_amount != null ? String(req.deposit_amount) : '')
  const [balance, setBalance] = useState(req.balance_amount != null ? String(req.balance_amount) : '')
  const [commissionRate, setCommissionRate] = useState(req.commission_rate != null ? String(req.commission_rate) : '')
  const [note, setNote] = useState(req.note ?? '')

  const paidPhases = new Set((req.payments ?? []).filter((p) => p.status === 'paid').map((p) => p.phase))
  const configuredPhases = (['survey', 'deposit', 'balance'] as ServicePhase[]).filter(
    (p) => Number(req[PHASE_FIELD[p]] ?? 0) > 0
  )

  const details = (req.details && typeof req.details === 'object' ? req.details : {}) as Record<string, unknown>
  const detailEntries = Object.entries(details).filter(([, v]) => v != null && v !== '')
  const assignedName = req.assigned_seller_id ? sellerName.get(req.assigned_seller_id) : null

  return (
    <Modal
      title={`Talep #${req.id.slice(-6).toUpperCase()} · ${req.service_title || SERVICE_KIND_LABEL[req.service_kind]}`}
      size="lg"
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Durum rozetleri */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Badge status={serviceRequestStatus(req.status)} />
          <Badge status={servicePaymentStatus(req.payment_status)} />
          {req.offer_sent_at && <Badge status={serviceOfferDecision(req.offer_decision)} />}
          {req.requires_survey === false && <Badge status={{ variant: 'neutral', label: 'Keşif Gerekmiyor' }} />}
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{formatDate(req.created_at)}</span>
        </div>

        {/* Müşteri & saha */}
        <div style={panel}>
          <Row icon={<User size={15} />} label="Müşteri" value={req.full_name} />
          <Row icon={<Phone size={15} />} label="Telefon" value={req.phone || '—'} />
          <Row icon={<Mail size={15} />} label="E-posta" value={req.email} />
          <Row
            icon={<MapPin size={15} />}
            label="Adres"
            value={
              [[req.city, req.district].filter(Boolean).join(' / '), req.address].filter(Boolean).join(' — ') ||
              'Belirtilmemiş'
            }
          />
          {req.preferred_dates && req.preferred_dates.length > 0 && (
            <Row
              icon={<Calendar size={15} />}
              label="Tercih Edilen Keşif Tarihleri"
              value={req.preferred_dates.map((d) => formatDateShort(d)).join(', ')}
            />
          )}
        </div>

        {/* Talep bilgileri */}
        {detailEntries.length > 0 && (
          <div>
            <SectionTitle icon={<ClipboardList size={15} />}>Talep Bilgileri</SectionTitle>
            <div style={panel}>
              {detailEntries.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>{prettyKey(k)}</span>
                  <span style={{ fontWeight: 500, textAlign: 'right' }}>{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {req.note && (
          <div style={{ fontSize: 13 }}>
            <span style={{ color: 'var(--text-tertiary)' }}>Müşteri notu: </span>
            <span style={{ whiteSpace: 'pre-wrap' }}>{req.note}</span>
          </div>
        )}

        {/* Keşif raporu (varsa) */}
        {req.survey_report && (
          <div>
            <SectionTitle icon={<FileText size={15} />}>Keşif Raporu</SectionTitle>
            <div style={{ ...panel, whiteSpace: 'pre-wrap', fontSize: 13 }}>{req.survey_report}</div>
          </div>
        )}

        {/* Teklif özeti (varsa) */}
        {req.offer_sent_at && (
          <div>
            <SectionTitle icon={<FileText size={15} />}>Teklif</SectionTitle>
            <div style={panel}>
              {req.offer_items && req.offer_items.length > 0 && (
                <table className="table" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>Kalem</th>
                      <th style={{ textAlign: 'right' }}>Adet</th>
                      <th style={{ textAlign: 'right' }}>Birim</th>
                      <th style={{ textAlign: 'right' }}>Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {req.offer_items.map((it, idx) => (
                      <tr key={idx}>
                        <td>{it.label}</td>
                        <td style={{ textAlign: 'right' }}>{it.qty ?? '—'}</td>
                        <td style={{ textAlign: 'right' }}>{it.unit_price != null ? formatLira(it.unit_price) : '—'}</td>
                        <td style={{ textAlign: 'right' }}>
                          {formatLira(it.total ?? (Number(it.qty) || 0) * (Number(it.unit_price) || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 6 }}>
                <span>Teklif Toplamı</span>
                <span>{formatLira(req.offer_total)}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                Gönderildi: {formatDate(req.offer_sent_at)}
                {req.offer_valid_until ? ` · Geçerlilik: ${formatDateShort(req.offer_valid_until)}` : ''}
              </div>
            </div>
          </div>
        )}

        {/* Montaj tarihleri (varsa) */}
        {(req.install_scheduled_at || req.install_done_at) && (
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            {req.install_scheduled_at && <>Montaj randevusu: <strong style={{ color: 'var(--text-primary)' }}>{formatDate(req.install_scheduled_at)}</strong></>}
            {req.install_done_at && <> · Tamamlandı: <strong style={{ color: 'var(--text-primary)' }}>{formatDate(req.install_done_at)}</strong></>}
          </div>
        )}

        {/* ───────── HAVUZ TEKLİFLERİ ───────── */}
        {req.is_bidding && (
          <div>
            <SectionTitle icon={<Gavel size={15} />}>Bayi Teklifleri (Havuz)</SectionTitle>
            {!req.bids || req.bids.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                Henüz teklif gelmedi. Bayiler havuzdan fiyat verince burada listelenir; en düşüğü seçtiğinizde
                bayiye atanır ve fiyat müşteriye teklif olarak gönderilir.
              </div>
            ) : (
              <table className="table" style={{ width: '100%', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Bayi</th>
                    <th style={{ textAlign: 'right' }}>Teklif</th>
                    <th style={{ textAlign: 'left' }}>Not</th>
                    <th style={{ textAlign: 'left' }}>Tarih</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {[...req.bids]
                    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
                    .map((b, i) => {
                      const isLowest = i === 0
                      const isWinner = req.assigned_seller_id === b.seller_id
                      return (
                        <tr key={b.seller_id}>
                          <td>
                            {sellerName.get(b.seller_id) ?? b.seller_name ?? `#${b.seller_id.slice(-6)}`}
                            {isLowest && (
                              <span style={{ marginLeft: 6 }}>
                                <Badge status={{ variant: 'success', label: 'En düşük' }} />
                              </span>
                            )}
                            {isWinner && (
                              <span style={{ marginLeft: 6 }}>
                                <Badge status={{ variant: 'info', label: 'Seçildi' }} />
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: isLowest ? 700 : 400 }}>{formatLira(b.price)}</td>
                          <td style={{ color: 'var(--text-tertiary)' }}>{b.note || '—'}</td>
                          <td style={{ color: 'var(--text-tertiary)' }}>{b.created_at ? formatDateShort(b.created_at) : '—'}</td>
                          <td style={{ textAlign: 'right' }}>
                            {!req.assigned_seller_id && (
                              <button
                                className="btn btn--primary btn--sm"
                                disabled={busy}
                                onClick={() =>
                                  onAction(
                                    { action: 'select_bid', seller_id: b.seller_id },
                                    'Teklif seçildi; bayiye atandı ve fiyat müşteriye teklif olarak gönderildi.'
                                  )
                                }
                              >
                                Seç
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ───────── ATAMA ───────── */}
        <div>
          <SectionTitle icon={<Store size={15} />}>Bayi Ataması</SectionTitle>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            Mevcut: {assignedName ? <strong>{assignedName}</strong> : <Badge status={{ variant: 'warning', label: 'Atanmadı' }} />}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="input" value={assignTo} onChange={(e) => setAssignTo(e.target.value)} style={{ minWidth: 220 }}>
              <option value="">Bayi seçin…</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.is_house ? ' (House)' : ''}
                  {s.status && s.status !== 'active' ? ` — ${s.status === 'suspended' ? 'askıda' : s.status}` : ''}
                </option>
              ))}
            </select>
            <button
              className="btn btn--primary btn--sm"
              disabled={busy || !assignTo || assignTo === req.assigned_seller_id}
              onClick={() => onAction({ action: 'assign', seller_id: assignTo }, 'Talep seçilen bayiye atandı.')}
            >
              <Store size={15} /> Ata
            </button>
            <button
              className="btn btn--ghost btn--sm"
              disabled={busy}
              onClick={() => onAction({ action: 'assign' }, 'Otomatik atama yapıldı (en uygun bayi).')}
              title="En az iş yükü olan uygun aktif bayiye otomatik ata"
            >
              <Wand2 size={15} /> Otomatik Ata
            </button>
          </div>
        </div>

        {/* ───────── DURUM OVERRIDE ───────── */}
        <div>
          <SectionTitle icon={<ClipboardList size={15} />}>Durum (Yönetici Override)</SectionTitle>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ minWidth: 220 }}>
              {STATUS_VALUES.map((v) => (
                <option key={v} value={v}>
                  {serviceRequestStatus(v).label}
                </option>
              ))}
            </select>
            <button
              className="btn btn--primary btn--sm"
              disabled={busy || status === req.status}
              onClick={() => onAction({ status }, 'Durum güncellendi.')}
            >
              Durumu Güncelle
            </button>
          </div>
        </div>

        {/* ───────── ÖDEME ───────── */}
        <div>
          <SectionTitle icon={<Wallet size={15} />}>Ödeme Yönetimi (₺ · tam lira)</SectionTitle>
          <div style={panel}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <Field label="Ödeme Durumu">
                <select className="input" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                  {PAYMENT_VALUES.map((v) => (
                    <option key={v} value={v}>
                      {servicePaymentStatus(v).label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Keşif Ücreti">
                <input className="input" type="number" min={0} value={surveyFee} onChange={(e) => setSurveyFee(e.target.value)} placeholder="0" style={{ width: 110 }} />
              </Field>
              <Field label="Kapora">
                <input className="input" type="number" min={0} value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="0" style={{ width: 110 }} />
              </Field>
              <Field label="Bakiye">
                <input className="input" type="number" min={0} value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0" style={{ width: 110 }} />
              </Field>
              <Field label="Komisyon %">
                <input className="input" type="number" min={0} max={100} value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} placeholder="10" style={{ width: 90 }} />
              </Field>
            </div>
            <button
              className="btn btn--primary btn--sm"
              style={{ marginTop: 10 }}
              disabled={busy}
              onClick={() =>
                onAction(
                  {
                    payment_status: paymentStatus,
                    survey_fee: surveyFee === '' ? undefined : Number(surveyFee),
                    deposit_amount: deposit === '' ? undefined : Number(deposit),
                    balance_amount: balance === '' ? undefined : Number(balance),
                    commission_rate: commissionRate === '' ? undefined : Number(commissionRate),
                  },
                  'Ödeme bilgileri kaydedildi.'
                )
              }
            >
              Ödeme Bilgilerini Kaydet
            </button>

            {/* Manuel tahsilat (havale/EFT veya PayTR dışı): fazı ödendi işaretle */}
            {configuredPhases.length > 0 && (
              <div style={{ marginTop: 14, borderTop: '1px solid var(--border-subtle, #2a2a2a)', paddingTop: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                  Manuel Tahsilat Kaydı (havale/EFT ile gelen ödeme):
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {configuredPhases.map((phase) => {
                    const paid = paidPhases.has(phase)
                    return (
                      <button
                        key={phase}
                        className="btn btn--ghost btn--sm"
                        disabled={busy || paid}
                        onClick={() =>
                          onAction(
                            { action: 'record_payment', phase },
                            `${PHASE_LABEL[phase]} tahsilatı kaydedildi.`
                          )
                        }
                      >
                        {paid ? `${PHASE_LABEL[phase]} ✓` : `${PHASE_LABEL[phase]} Tahsil Edildi`}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Tahsilat dökümü */}
            {req.payments && req.payments.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>Tahsilat Dökümü</div>
                <table className="table" style={{ fontSize: 12 }}>
                  <tbody>
                    {req.payments.map((p, i) => (
                      <tr key={i}>
                        <td>{PHASE_LABEL[p.phase] ?? p.phase}</td>
                        <td style={{ textAlign: 'right' }}>{formatLira(p.amount)}</td>
                        <td>{p.method === 'paytr' ? 'PayTR' : 'Manuel'}</td>
                        <td>
                          {p.status === 'paid' ? (
                            <Badge status={{ variant: 'success', label: 'Ödendi' }} />
                          ) : (
                            <Badge status={{ variant: 'warning', label: 'Bekliyor' }} />
                          )}
                        </td>
                        <td style={{ color: 'var(--text-tertiary)' }}>{p.paid_at ? formatDateShort(p.paid_at) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6, fontWeight: 600 }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Toplam Tahsil Edilen</span>
                  <span>{formatLira(req.paid_total ?? 0)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ───────── PAYOUT (BAYİYE AKTARIM) ───────── */}
        <div>
          <SectionTitle icon={<Wallet size={15} />}>Bayi Hakedişi / Payout</SectionTitle>
          <div style={panel}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Badge status={servicePayoutStatus(req.payout_status)} />
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                Komisyon (%{req.commission_rate ?? 0}):{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{formatLira(req.commission_amount ?? 0)}</strong>
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                Bayiye Net:{' '}
                <strong style={{ color: 'var(--accent-primary)' }}>{formatLira(req.payout_amount ?? 0)}</strong>
              </span>
            </div>
            {req.payout_trans_id && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                Transfer ref: {req.payout_trans_id}
                {req.paid_at ? ` · ${formatDate(req.paid_at)}` : ''}
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              {req.payout_status === 'paid' ? (
                <span style={{ fontSize: 13, color: 'var(--success, #16a34a)', fontWeight: 600 }}>
                  ✓ Bayiye ödeme aktarıldı.
                </span>
              ) : (
                <button
                  className="btn btn--primary btn--sm"
                  disabled={busy || req.payout_status !== 'eligible'}
                  onClick={onPayout}
                  title={req.payout_status !== 'eligible' ? 'Tam ödeme + iş teslimi sonrası aktifleşir.' : ''}
                >
                  Bayiye Aktar (Payout)
                </button>
              )}
              {req.payout_status === 'pending' && (
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 10 }}>
                  Tam ödeme alınıp iş teslim edildiğinde hakediş açılır.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ───────── NOT ───────── */}
        <div>
          <SectionTitle icon={<FileText size={15} />}>Yönetici Notu</SectionTitle>
          <textarea
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="İç not (müşteriye gösterilmez)..."
            style={{ width: '100%', resize: 'vertical' }}
          />
          <button
            className="btn btn--ghost btn--sm"
            style={{ marginTop: 8 }}
            disabled={busy || note === (req.note ?? '')}
            onClick={() => onAction({ note }, 'Not kaydedildi.')}
          >
            Notu Kaydet
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ───────────────────────── Küçük yardımcılar ─────────────────────────

const panel: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '12px 14px',
  background: 'var(--bg-secondary)',
  borderRadius: 'var(--radius-md, 8px)',
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
      <span style={{ color: 'var(--accent-primary)' }}>{icon}</span>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</span>
      {children}
    </div>
  )
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ color: 'var(--accent-primary)', marginTop: 2 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{value}</div>
      </div>
    </div>
  )
}
