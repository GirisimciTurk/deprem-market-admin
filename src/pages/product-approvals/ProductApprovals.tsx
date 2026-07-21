import { useState } from 'react'
import { toReachableImageUrl } from '../../lib/image-url'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { ClipboardCheck, Package, Check, X, Store, Calendar, Barcode } from 'lucide-react'
import Header from '../../components/layout/Header'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Pagination from '../../components/ui/Pagination'
import { LoadingState } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/StateBox'
import { useToast } from '../../components/ui/toast-context'
import { api } from '../../lib/api'
import { formatMoney } from '../../lib/format'
import type { StatusMeta } from '../../lib/statusLabels'

const LIMIT = 20

interface ApprovalVariantPrice {
  amount: number
  currency_code: string
}

interface ApprovalVariant {
  sku: string | null
  prices: ApprovalVariantPrice[]
}

interface AiModeration {
  action?: string
  verdict?: string
  confidence?: number
  reason?: string
}
interface AiSuggestions {
  suggested_category?: string
  description?: string
  bullet_points?: string[]
  tags?: string[]
}
interface Rejection {
  reason?: string | null
  at?: string
}
interface ApprovalProduct {
  id: string
  title: string
  status: string
  thumbnail: string | null
  handle: string
  created_at: string
  seller: { id: string; name: string; handle: string } | null
  variants: ApprovalVariant[]
  metadata: {
    ai_moderation?: AiModeration
    ai_suggestions?: AiSuggestions
    rejection?: Rejection
    last_rejection?: Rejection
  } | null
}

/**
 * Red gerekçesini gösterir. `rejection` aktif reddi, `last_rejection` satıcının
 * düzeltip yeniden onaya gönderdiği ürünün önceki reddini temsil eder — ikincisi
 * "aynı hatayı tekrar etmiş mi?" kontrolü için onay kuyruğunda değerlidir.
 */
function RejectionInfo({ metadata }: { metadata: ApprovalProduct['metadata'] }) {
  const active = metadata?.rejection
  const previous = metadata?.last_rejection
  const shown = active ?? previous
  if (!shown?.reason) return null
  const isPrevious = !active
  return (
    <div
      style={{ marginTop: 6, fontSize: '0.72rem', lineHeight: 1.5, maxWidth: 340, padding: '6px 8px', borderRadius: 'var(--radius-sm)', color: isPrevious ? 'var(--text-secondary)' : '#b91c1c', background: isPrevious ? 'var(--bg-tertiary)' : '#fef2f2' }}
    >
      <b>{isPrevious ? 'Önceki red gerekçesi' : 'Red gerekçesi'}:</b> {shown.reason}
      {shown.at && (
        <span className="muted"> · {new Date(shown.at).toLocaleDateString('tr-TR')}</span>
      )}
    </div>
  )
}

/** Ürünün AI değerlendirmesini ve içerik önerisini kompakt gösterir. */
function ProductAiInfo({ metadata }: { metadata: ApprovalProduct['metadata'] }) {
  const mod = metadata?.ai_moderation
  const sug = metadata?.ai_suggestions
  if (!mod && !sug) return null
  const map: Record<string, { label: string; color: string; bg: string }> = {
    auto_approve: { label: 'AI: Onaylanabilir', color: '#047857', bg: '#ecfdf5' },
    auto_reject: { label: 'AI: Reddedildi', color: '#b91c1c', bg: '#fef2f2' },
    needs_review: { label: 'AI: İncele', color: '#b45309', bg: '#fffbeb' },
    error: { label: 'AI: Hata', color: '#6b7280', bg: '#f3f4f6' },
  }
  const m = mod?.action ? (map[mod.action] ?? map.error) : null
  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {m && (
        <span
          title={mod?.reason || ''}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: m.color, background: m.bg, width: 'fit-content' }}
        >
          🤖 {m.label}{mod?.confidence != null ? ` %${mod.confidence}` : ''}
        </span>
      )}
      {mod?.reason && <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontStyle: 'italic', maxWidth: 320 }}>{mod.reason}</span>}
      {sug && (
        <details style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
          <summary style={{ cursor: 'pointer', color: 'var(--accent-primary)' }}>💡 AI içerik önerisi</summary>
          <div style={{ marginTop: 4, lineHeight: 1.5 }}>
            {sug.suggested_category && <div><b>Kategori:</b> {sug.suggested_category}</div>}
            {sug.description && <div><b>Açıklama:</b> {sug.description}</div>}
            {sug.tags?.length ? <div><b>Etiketler:</b> {sug.tags.join(', ')}</div> : null}
          </div>
        </details>
      )}
    </div>
  )
}

interface ApprovalsResponse {
  products: ApprovalProduct[]
  count: number
  offset: number
  limit: number
}

function approvalStatus(status: string): StatusMeta {
  if (status === 'published') return { label: 'Yayında', variant: 'success' }
  if (status === 'rejected') return { label: 'Reddedildi', variant: 'danger' }
  if (status === 'draft') return { label: 'Taslak', variant: 'neutral' }
  return { label: 'Onay Bekliyor', variant: 'warning' }
}

function variantPrice(variant: ApprovalVariant | undefined): string {
  if (!variant) return '-'
  const price = variant.prices?.find((p) => p.currency_code?.toLowerCase() === 'try') ?? variant.prices?.[0]
  if (!price) return '-'
  return formatMoney(price.amount, price.currency_code)
}

export default function ProductApprovals() {
  const { notify } = useToast()
  const qc = useQueryClient()
  const [offset, setOffset] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string>('proposed')

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['product-approvals', offset, statusFilter],
    queryFn: () =>
      api.get<ApprovalsResponse>('/admin/product-approvals', {
        status: statusFilter,
        limit: LIMIT,
        offset,
      }),
    placeholderData: keepPreviousData,
  })
  const products = data?.products ?? []

  // Reddedilecek ürün (modal açık) + gerekçe metni.
  const [rejecting, setRejecting] = useState<ApprovalProduct | null>(null)
  const [reason, setReason] = useState('')

  const actionMutation = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: 'publish' | 'reject'; reason?: string }) =>
      api.post<{ id: string; status: string }>(`/admin/product-approvals/${id}`, {
        action,
        ...(reason ? { reason } : {}),
      }),
    onSuccess: (_r, vars) => {
      notify(
        vars.action === 'publish'
          ? 'Ürün yayına alındı, satıcıya bildirildi.'
          : 'Ürün reddedildi, gerekçe satıcıya bildirildi.'
      )
      setRejecting(null)
      setReason('')
      qc.invalidateQueries({ queryKey: ['product-approvals'] })
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  function handlePublish(p: ApprovalProduct) {
    actionMutation.mutate({ id: p.id, action: 'publish' })
  }

  function openReject(p: ApprovalProduct) {
    setRejecting(p)
    setReason('')
  }

  function confirmReject() {
    if (!rejecting) return
    const trimmed = reason.trim()
    if (!trimmed) {
      notify('Satıcının ne düzelteceğini bilmesi için gerekçe yazın.', 'error')
      return
    }
    actionMutation.mutate({ id: rejecting.id, action: 'reject', reason: trimmed })
  }

  return (
    <>
      <Header title="Ürün Onayları" subtitle="Satıcıların eklediği ürünleri inceleyin, yayına alın veya reddedin" />

      <div style={{ padding: '24px' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setOffset(0)
            }}
            style={{ width: 'auto', minWidth: '180px' }}
          >
            <option value="proposed">Onay Bekleyen</option>
            <option value="published">Yayında</option>
            <option value="rejected">Reddedilen</option>
          </select>
        </div>

        {/* Content */}
        {isLoading ? (
          <LoadingState label="Ürünler yükleniyor..." />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : products.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck size={26} />}
            title="Ürün bulunamadı"
            description={
              statusFilter === 'proposed'
                ? 'Onay bekleyen ürün yok.'
                : 'Bu duruma uygun ürün bulunmuyor.'
            }
          />
        ) : (
          <>
            <div className="table-container animate-fadeIn" style={{ opacity: isFetching ? 0.7 : 1 }}>
              <table>
                <thead>
                  <tr>
                    <th>Ürün</th>
                    <th>Satıcı</th>
                    <th>SKU</th>
                    <th>Fiyat</th>
                    <th>Durum</th>
                    <th>Eklenme</th>
                    <th style={{ textAlign: 'right' }}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const firstVariant = p.variants?.[0]
                    return (
                      <tr key={p.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {p.thumbnail ? (
                              <img
                                src={toReachableImageUrl(p.thumbnail)}
                                alt={p.title}
                                style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', objectFit: 'cover', border: '1px solid var(--border-primary)' }}
                              />
                            ) : (
                              <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Package size={16} style={{ color: 'var(--text-tertiary)' }} />
                              </div>
                            )}
                            <div>
                              <div style={{ fontWeight: 600 }}>{p.title}</div>
                              <div className="muted" style={{ fontSize: '0.76rem' }}>{p.handle}</div>
                              <ProductAiInfo metadata={p.metadata} />
                              <RejectionInfo metadata={p.metadata} />
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem' }}>
                            <Store size={13} className="muted" /> {p.seller?.name || <span className="muted">—</span>}
                          </span>
                        </td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem' }}>
                            {firstVariant?.sku ? (
                              <>
                                <Barcode size={13} className="muted" /> {firstVariant.sku}
                              </>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </span>
                        </td>
                        <td className="nowrap">{variantPrice(firstVariant)}</td>
                        <td>
                          <Badge status={approvalStatus(p.status)} />
                        </td>
                        <td className="muted" style={{ fontSize: '0.82rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={13} /> {new Date(p.created_at).toLocaleDateString('tr-TR')}
                          </span>
                        </td>
                        <td>
                          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                            {p.status !== 'published' && (
                              <button
                                className="btn btn--secondary btn--sm"
                                style={{ color: 'var(--accent-success)' }}
                                title="Yayına Al"
                                disabled={actionMutation.isPending}
                                onClick={() => handlePublish(p)}
                              >
                                <Check size={14} /> Yayına Al
                              </button>
                            )}
                            {p.status !== 'rejected' && (
                              <button
                                className="btn btn--secondary btn--sm"
                                style={{ color: 'var(--accent-danger)' }}
                                title="Reddet"
                                disabled={actionMutation.isPending}
                                onClick={() => openReject(p)}
                              >
                                <X size={14} /> Reddet
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination offset={offset} limit={LIMIT} count={data?.count ?? 0} onChange={setOffset} />
          </>
        )}
      </div>

      {rejecting && (
        <Modal
          title="Ürünü Reddet"
          onClose={() => setRejecting(null)}
          footer={
            <>
              <button className="btn btn--secondary" onClick={() => setRejecting(null)}>
                Vazgeç
              </button>
              <button
                className="btn btn--primary"
                style={{ background: 'var(--accent-danger)' }}
                disabled={actionMutation.isPending || !reason.trim()}
                onClick={confirmReject}
              >
                {actionMutation.isPending ? 'Reddediliyor...' : 'Reddet ve Bildir'}
              </button>
            </>
          }
        >
          <p style={{ marginBottom: 12, fontSize: '0.9rem' }}>
            <b>{rejecting.title}</b> ürünü reddedilecek.
          </p>
          <label htmlFor="reject-reason" style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 600 }}>
            Red gerekçesi
          </label>
          <textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={1000}
            autoFocus
            placeholder="Örn. Ürün görselleri bulanık ve marka etiketi okunmuyor. Net görseller yükleyip tekrar gönderin."
            style={{ width: '100%', resize: 'vertical' }}
          />
          <p className="muted" style={{ marginTop: 8, fontSize: '0.78rem', lineHeight: 1.5 }}>
            Gerekçe satıcıya bildirim olarak iletilir ve ürün düzenleme ekranında gösterilir.
            Satıcı ürünü düzeltip kaydettiğinde ürün yeniden onay kuyruğuna düşer.
          </p>
        </Modal>
      )}
    </>
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
