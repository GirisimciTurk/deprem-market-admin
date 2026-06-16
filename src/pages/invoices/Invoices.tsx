import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Receipt, Search, Eye, Send, Info, Download, ArrowRight, Printer, CheckCircle } from 'lucide-react'
import Header from '../../components/layout/Header'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import Pagination from '../../components/ui/Pagination'
import { LoadingState, Spinner } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/StateBox'
import { useToast } from '../../components/ui/toast-context'
import { useDebounce } from '../../lib/useDebounce'
import { api } from '../../lib/api'
import { formatMoney } from '../../lib/format'
import { printInvoice } from '../../lib/invoice-print'
import type { StatusMeta } from '../../lib/statusLabels'

const LIMIT = 20

type InvoiceType = 'sale' | 'commission'
type InvoiceStatus = 'draft' | 'sent' | 'error'

interface InvoiceLine {
  name: string
  quantity: number
  unit_price_gross: number
  line_gross: number
  line_net: number
  line_kdv: number
  kdv_rate: number
}

interface Invoice {
  id: string
  type: InvoiceType
  status: InvoiceStatus
  draft_number: string
  invoice_number: string | null
  issue_date: string
  issuer_name: string
  issuer_tax_number: string | null
  recipient_name: string
  recipient_tax_number: string | null
  recipient_email: string | null
  recipient_address: Record<string, unknown> | null
  order_id: string
  display_id: number | null
  seller_order_id: string | null
  seller_id: string | null
  currency_code: string
  net_total: number
  tax_total: number
  grand_total: number
  tax_rate: number
  lines: InvoiceLine[] | null
  ubl_payload: Record<string, unknown> | null
  provider: string | null
  external_id: string | null
  sent_at: string | null
  error_message: string | null
}

interface InvoicesResponse {
  invoices: Invoice[]
  count: number
  offset: number
  limit: number
}

function typeBadge(type: InvoiceType): StatusMeta {
  if (type === 'commission') return { label: 'Komisyon Faturası', variant: 'neutral' }
  return { label: 'Satış Faturası', variant: 'info' }
}

function statusBadge(status: InvoiceStatus): StatusMeta {
  if (status === 'sent') return { label: 'Gönderildi', variant: 'success' }
  if (status === 'error') return { label: 'Hata', variant: 'danger' }
  return { label: 'Taslak', variant: 'warning' }
}

function formatAddress(address: Record<string, unknown> | null): string {
  if (!address) return ''
  const order = ['address', 'address_1', 'address_2', 'district', 'neighborhood', 'city', 'province', 'postal_code', 'country', 'country_code']
  const seen = new Set<string>()
  const parts: string[] = []
  for (const key of order) {
    const v = address[key]
    if (typeof v === 'string' && v.trim()) {
      parts.push(v.trim())
      seen.add(key)
    }
  }
  for (const [key, v] of Object.entries(address)) {
    if (seen.has(key)) continue
    if (typeof v === 'string' && v.trim()) parts.push(v.trim())
    else if (typeof v === 'number') parts.push(String(v))
  }
  return parts.join(', ')
}

export default function Invoices() {
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [detail, setDetail] = useState<Invoice | null>(null)
  const debounced = useDebounce(search)

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['invoices', offset, debounced, typeFilter, statusFilter],
    queryFn: () =>
      api.get<InvoicesResponse>('/admin/invoices', {
        limit: LIMIT,
        offset,
        q: debounced || undefined,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
      }),
    placeholderData: keepPreviousData,
  })
  const invoices = data?.invoices ?? []

  return (
    <>
      <Header title="Faturalar" subtitle="Satış ve komisyon faturalarını görüntüleyin, e-fatura olarak gönderin" />

      <div style={{ padding: '24px' }}>
        {/* Info banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            padding: '12px 16px',
            marginBottom: '20px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
          }}
        >
          <Info size={16} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--accent-warning)' }} />
          <span>
            Faturalar şu an taslak modunda üretilir; bir e-fatura entegratörü (EINVOICE_PROVIDER) bağlanınca GİB'e
            gönderim açılır.
          </span>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div className="header__search" style={{ flex: 1, minWidth: '220px' }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Belge no, düzenleyen veya alıcı ara..."
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
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value)
              setOffset(0)
            }}
            style={{ width: 'auto', minWidth: '150px' }}
          >
            <option value="">Tüm Türler</option>
            <option value="sale">Satış</option>
            <option value="commission">Komisyon</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setOffset(0)
            }}
            style={{ width: 'auto', minWidth: '150px' }}
          >
            <option value="">Tüm Durumlar</option>
            <option value="draft">Taslak</option>
            <option value="sent">Gönderildi</option>
            <option value="error">Hata</option>
          </select>
        </div>

        {/* Content */}
        {isLoading ? (
          <LoadingState label="Faturalar yükleniyor..." />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={<Receipt size={26} />}
            title="Fatura bulunamadı"
            description={
              search || typeFilter || statusFilter
                ? 'Filtreye uygun fatura yok.'
                : 'Henüz fatura üretilmemiş.'
            }
          />
        ) : (
          <>
            <div className="table-container animate-fadeIn" style={{ opacity: isFetching ? 0.7 : 1 }}>
              <table>
                <thead>
                  <tr>
                    <th>Belge No</th>
                    <th>Tür</th>
                    <th>Düzenleyen → Alıcı</th>
                    <th>Tutar</th>
                    <th>Tarih</th>
                    <th>Durum</th>
                    <th style={{ textAlign: 'right' }}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{inv.draft_number}</div>
                        {inv.invoice_number && (
                          <div className="muted" style={{ fontSize: '0.76rem', marginTop: '2px' }}>
                            {inv.invoice_number}
                          </div>
                        )}
                      </td>
                      <td>
                        <Badge status={typeBadge(inv.type)} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                          <span>{inv.issuer_name}</span>
                          <ArrowRight size={13} className="muted" style={{ flexShrink: 0 }} />
                          <span>{inv.recipient_name}</span>
                        </div>
                      </td>
                      <td className="nowrap">
                        <div style={{ fontWeight: 600 }}>{formatMoney(inv.grand_total, inv.currency_code)}</div>
                        <div className="muted" style={{ fontSize: '0.72rem' }}>KDV dahil</div>
                      </td>
                      <td className="muted" style={{ fontSize: '0.82rem' }}>
                        {new Date(inv.issue_date).toLocaleDateString('tr-TR')}
                      </td>
                      <td>
                        <Badge status={statusBadge(inv.status)} />
                      </td>
                      <td>
                        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn--secondary btn--icon btn--sm"
                            title="Detay"
                            onClick={() => setDetail(inv)}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            className="btn btn--secondary btn--icon btn--sm"
                            title="Yazdır / PDF"
                            onClick={() => printInvoice(inv)}
                          >
                            <Printer size={14} />
                          </button>
                          {inv.status !== 'sent' && <SendButton invoice={inv} />}
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

      {detail && <DetailModal invoice={detail} onClose={() => setDetail(null)} />}
    </>
  )
}

function SendButton({ invoice }: { invoice: Invoice }) {
  const { notify } = useToast()
  const qc = useQueryClient()

  const sendMutation = useMutation({
    mutationFn: () => api.post<{ ok: boolean; result: unknown }>(`/admin/invoices/${invoice.id}/send`, {}),
    onSuccess: () => {
      notify('Fatura gönderildi.')
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  return (
    <button
      className="btn btn--secondary btn--icon btn--sm"
      style={{ color: 'var(--accent-primary)' }}
      title="Gönder"
      disabled={sendMutation.isPending}
      onClick={() => sendMutation.mutate()}
    >
      <Send size={14} />
    </button>
  )
}

function DetailModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { notify } = useToast()
  const qc = useQueryClient()
  const [showUbl, setShowUbl] = useState(false)
  const [manualNo, setManualNo] = useState(invoice.invoice_number ?? '')
  const lines = invoice.lines ?? []
  const currency = invoice.currency_code
  const address = formatAddress(invoice.recipient_address)

  const sendMutation = useMutation({
    mutationFn: () => api.post<{ ok: boolean; result: unknown }>(`/admin/invoices/${invoice.id}/send`, {}),
    onSuccess: () => {
      notify('Fatura gönderildi.')
      qc.invalidateQueries({ queryKey: ['invoices'] })
      onClose()
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  // Manuel kesim: başka yerde (muhasebeci / entegratör paneli / GİB) kesilen resmi
  // fatura numarasını gir → durum "Düzenlendi" (sent) olur. Entegratör API'si gerekmez.
  const markMutation = useMutation({
    mutationFn: () =>
      api.post<{ invoice: Invoice }>(`/admin/invoices/${invoice.id}/mark-issued`, {
        invoice_number: manualNo.trim(),
      }),
    onSuccess: () => {
      notify('Fatura "Düzenlendi" olarak işaretlendi.')
      qc.invalidateQueries({ queryKey: ['invoices'] })
      onClose()
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  function downloadUbl() {
    if (!invoice.ubl_payload) return
    const blob = new Blob([JSON.stringify(invoice.ubl_payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${invoice.draft_number}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Modal
      title={`Fatura: ${invoice.draft_number}`}
      onClose={onClose}
      size="lg"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="btn btn--secondary" onClick={onClose}>Kapat</button>
          <button className="btn btn--secondary" onClick={() => printInvoice(invoice)}>
            <Printer size={16} /> Yazdır / PDF
          </button>
          {invoice.status !== 'sent' && (
            <button
              className="btn btn--primary"
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
              title="Bağlı e-fatura entegratörüne gönderir (tanımlı değilse taslak kalır)"
            >
              <Send size={16} /> {sendMutation.isPending ? 'Gönderiliyor...' : 'Entegratöre Gönder'}
            </button>
          )}
        </div>
      }
    >
      {/* Meta row */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <Badge status={typeBadge(invoice.type)} />
        <Badge status={statusBadge(invoice.status)} />
        {invoice.invoice_number && (
          <span className="muted" style={{ fontSize: '0.82rem', alignSelf: 'center' }}>
            Resmi No: {invoice.invoice_number}
          </span>
        )}
        <span className="muted" style={{ fontSize: '0.82rem', alignSelf: 'center', marginLeft: 'auto' }}>
          {new Date(invoice.issue_date).toLocaleDateString('tr-TR')}
        </span>
      </div>

      {/* Error box */}
      {invoice.status === 'error' && invoice.error_message && (
        <div
          style={{
            padding: '12px 14px',
            marginBottom: '20px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--accent-danger)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--accent-danger)',
            fontSize: '0.85rem',
          }}
        >
          {invoice.error_message}
        </div>
      )}

      {/* Parties */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <PartyCard label="Düzenleyen">
          <div style={{ fontWeight: 600 }}>{invoice.issuer_name}</div>
          {invoice.issuer_tax_number && (
            <div className="muted" style={{ fontSize: '0.8rem', marginTop: '2px' }}>VKN/TCKN: {invoice.issuer_tax_number}</div>
          )}
        </PartyCard>
        <PartyCard label="Alıcı">
          <div style={{ fontWeight: 600 }}>{invoice.recipient_name}</div>
          {invoice.recipient_tax_number && (
            <div className="muted" style={{ fontSize: '0.8rem', marginTop: '2px' }}>VKN/TCKN: {invoice.recipient_tax_number}</div>
          )}
          {invoice.recipient_email && (
            <div className="muted" style={{ fontSize: '0.8rem', marginTop: '2px' }}>{invoice.recipient_email}</div>
          )}
          {address && (
            <div className="muted" style={{ fontSize: '0.8rem', marginTop: '2px' }}>{address}</div>
          )}
        </PartyCard>
      </div>

      {/* Lines */}
      <div className="table-container" style={{ marginBottom: '20px' }}>
        <table>
          <thead>
            <tr>
              <th>Açıklama</th>
              <th style={{ textAlign: 'right' }}>Adet</th>
              <th style={{ textAlign: 'right' }}>Birim Fiyat</th>
              <th style={{ textAlign: 'right' }}>Net</th>
              <th style={{ textAlign: 'right' }}>KDV</th>
              <th style={{ textAlign: 'right' }}>Tutar</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: '20px' }}>
                  Kalem bilgisi yok.
                </td>
              </tr>
            ) : (
              lines.map((l, i) => (
                <tr key={i}>
                  <td>{l.name}</td>
                  <td className="nowrap" style={{ textAlign: 'right' }}>{l.quantity}</td>
                  <td className="nowrap" style={{ textAlign: 'right' }}>{formatMoney(l.unit_price_gross, currency)}</td>
                  <td className="nowrap" style={{ textAlign: 'right' }}>{formatMoney(l.line_net, currency)}</td>
                  <td className="nowrap" style={{ textAlign: 'right' }}>
                    {formatMoney(l.line_kdv, currency)}
                    <span className="muted" style={{ fontSize: '0.72rem' }}> (%{l.kdv_rate})</span>
                  </td>
                  <td className="nowrap" style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(l.line_gross, currency)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
        <div style={{ minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <TotalRow label="Net Toplam" value={formatMoney(invoice.net_total, currency)} />
          <TotalRow label={`KDV (%${invoice.tax_rate})`} value={formatMoney(invoice.tax_total, currency)} />
          <div style={{ height: '1px', background: 'var(--border-primary)' }} />
          <TotalRow label="Genel Toplam" value={formatMoney(invoice.grand_total, currency)} strong />
        </div>
      </div>

      {/* Manuel kesim — resmi fatura no gir + Düzenlendi işaretle (entegratör gerekmez) */}
      {invoice.status !== 'sent' && (
        <div
          style={{
            padding: '14px 16px',
            marginBottom: '20px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>Manuel Fatura Kaydı</div>
          <div className="muted" style={{ fontSize: '0.8rem', marginBottom: '10px' }}>
            Faturayı muhasebeci / entegratör paneli / GİB e-Arşiv'de kestiysen resmi numarasını gir → durum "Düzenlendi" olur.
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Resmi fatura no (ör. EAR2026000001234)"
              value={manualNo}
              onChange={(e) => setManualNo(e.target.value)}
              style={{ flex: 1, minWidth: '220px' }}
            />
            <button
              className="btn btn--primary"
              onClick={() => markMutation.mutate()}
              disabled={markMutation.isPending || !manualNo.trim()}
            >
              {markMutation.isPending ? <Spinner size={14} /> : <CheckCircle size={16} />} Düzenlendi İşaretle
            </button>
          </div>
        </div>
      )}

      {/* UBL payload */}
      {invoice.ubl_payload && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <button className="btn btn--secondary btn--sm" onClick={() => setShowUbl((v) => !v)}>
              {showUbl ? 'UBL-TR Taslağını Gizle' : 'UBL-TR Taslağını Göster'}
            </button>
            <button className="btn btn--secondary btn--sm" onClick={downloadUbl}>
              <Download size={14} /> JSON indir
            </button>
          </div>
          {showUbl && (
            <pre
              style={{
                margin: 0,
                padding: '14px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.78rem',
                maxHeight: '320px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {JSON.stringify(invoice.ubl_payload, null, 2)}
            </pre>
          )}
        </div>
      )}
    </Modal>
  )
}

function PartyCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
      }}
    >
      <div className="muted" style={{ fontSize: '0.76rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '16px' }}>
      <span className="muted" style={{ fontSize: strong ? '0.9rem' : '0.82rem' }}>{label}</span>
      <span style={{ fontWeight: strong ? 700 : 500, fontSize: strong ? '1.05rem' : '0.9rem', color: strong ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
        {value}
      </span>
    </div>
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
