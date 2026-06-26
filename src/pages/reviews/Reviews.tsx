import { useState } from 'react'
import { toReachableImageUrl } from '../../lib/image-url'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  MessageSquare,
  Search,
  Check,
  AlertTriangle,
  Trash2,
  Star,
  Package,
  User,
  Calendar
} from 'lucide-react'
import Header from '../../components/layout/Header'
import Badge from '../../components/ui/Badge'
import Pagination from '../../components/ui/Pagination'
import { LoadingState } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/StateBox'
import { useToast } from '../../components/ui/toast-context'
import { useDebounce } from '../../lib/useDebounce'
import { api } from '../../lib/api'

const LIMIT = 20

interface ProductReview {
  id: string
  productName: string
  customerName: string
  rating: number
  comment: string
  status: 'pending' | 'approved' | 'spam'
  createdAt: string
  images: string[]
  aiAction: string | null
  aiConfidence: number | null
  aiReason: string | null
}

interface BackendReview {
  id: string
  product_title: string
  customer_name: string
  rating: number
  comment: string
  status: 'pending' | 'approved' | 'spam'
  created_at: string
  images: string[] | null
  ai_action: string | null
  ai_confidence: number | null
  ai_reason: string | null
}

function mapReview(r: BackendReview): ProductReview {
  return {
    id: r.id,
    productName: r.product_title,
    customerName: r.customer_name,
    rating: r.rating,
    comment: r.comment,
    status: r.status,
    createdAt: r.created_at,
    images: Array.isArray(r.images) ? r.images : [],
    aiAction: r.ai_action ?? null,
    aiConfidence: r.ai_confidence ?? null,
    aiReason: r.ai_reason ?? null,
  }
}

/** AI moderasyon kararını küçük bir rozet olarak gösterir. */
function AiBadge({ action, confidence, reason }: { action: string | null; confidence: number | null; reason: string | null }) {
  if (!action) return null
  const map: Record<string, { label: string; color: string; bg: string }> = {
    auto_approve: { label: 'AI: Onayladı', color: '#047857', bg: '#ecfdf5' },
    auto_reject: { label: 'AI: Reddetti', color: '#b91c1c', bg: '#fef2f2' },
    needs_review: { label: 'AI: İncele', color: '#b45309', bg: '#fffbeb' },
    error: { label: 'AI: Hata', color: '#6b7280', bg: '#f3f4f6' },
  }
  const m = map[action] ?? map.error
  return (
    <div style={{ marginTop: 8, display: 'flex', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap' }}>
      <span
        title={reason || ''}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', fontWeight: 700,
          padding: '2px 8px', borderRadius: 999, color: m.color, background: m.bg, whiteSpace: 'nowrap',
        }}
      >
        🤖 {m.label}{confidence != null ? ` %${confidence}` : ''}
      </span>
      {reason && (
        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontStyle: 'italic', maxWidth: 360 }}>
          {reason}
        </span>
      )}
    </div>
  )
}

export default function Reviews() {
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [lightbox, setLightbox] = useState<string | null>(null)
  const debounced = useDebounce(search)

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['reviews', offset, debounced, statusFilter],
    queryFn: () =>
      api.get<{ reviews: BackendReview[]; count: number }>('/admin/reviews', {
        limit: LIMIT,
        offset,
        q: debounced || undefined,
        status: statusFilter || undefined,
      }),
    placeholderData: keepPreviousData,
  })

  const reviews: ProductReview[] = (data?.reviews ?? []).map(mapReview)

  const statusMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string
      status: 'approved' | 'spam' | 'pending'
    }) => api.post(`/admin/reviews/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reviews'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/reviews/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reviews'] }),
  })

  // Action handlers
  const handleApprove = async (id: string) => {
    try {
      await statusMutation.mutateAsync({ id, status: 'approved' })
      notify('Yorum yayınlandı.', 'success')
    } catch {
      notify('İşlem başarısız oldu.', 'error')
    }
  }

  const handleSpam = async (id: string) => {
    try {
      await statusMutation.mutateAsync({ id, status: 'spam' })
      notify('Yorum spam olarak işaretlendi.', 'info')
    } catch {
      notify('İşlem başarısız oldu.', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bu yorumu silmek istediğinize emin misiniz?')) return
    try {
      await deleteMutation.mutateAsync(id)
      notify('Yorum silindi.')
    } catch {
      notify('Silme işlemi başarısız oldu.', 'error')
    }
  }

  // Star rendering helper
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        size={14}
        style={{
          fill: i < rating ? 'var(--accent-warning)' : 'none',
          color: i < rating ? 'var(--accent-warning)' : 'var(--text-tertiary)',
          marginRight: '2px'
        }}
      />
    ))
  }

  return (
    <>
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Yorum fotoğrafı"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
            cursor: 'zoom-out',
          }}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Kapat"
            style={{
              position: 'absolute',
              top: 20,
              right: 24,
              width: 38,
              height: 38,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(0,0,0,0.6)',
              color: '#fff',
              fontSize: '1.1rem',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
          <img
            src={toReachableImageUrl(lightbox)}
            alt="Yorum fotoğrafı"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 'var(--radius-md)' }}
          />
        </div>
      )}

      <Header title="Yorumlar" subtitle="Ürün yorumlarını moderasyon edin ve puanları izleyin" />

      <div style={{ padding: '24px' }}>
        {/* Filter bar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div className="header__search" style={{ flex: 1, minWidth: '220px' }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Ürün, müşteri veya yorum içeriği ara..."
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
            <option value="pending">Onay Bekleyenler</option>
            <option value="approved">Onaylananlar</option>
            <option value="spam">Spam Olarak İşaretlenenler</option>
          </select>
        </div>

        {/* Content list */}
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState message="Yorumlar yüklenemedi." onRetry={() => refetch()} />
        ) : reviews.length === 0 ? (
          <EmptyState
            icon={<MessageSquare size={26} />}
            title="Yorum bulunamadı"
            description={debounced || statusFilter ? 'Filtreye uygun yorum yok.' : 'Henüz hiç yorum yapılmamış.'}
          />
        ) : (
          <>
          <div className="table-container animate-fadeIn" style={{ opacity: isFetching ? 0.7 : 1 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '220px' }}>Ürün</th>
                  <th style={{ width: '150px' }}>Müşteri</th>
                  <th style={{ width: '120px' }}>Puan</th>
                  <th>Yorum</th>
                  <th style={{ width: '120px' }}>Durum</th>
                  <th style={{ width: '140px' }}>Tarih</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <tr key={review.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.85rem' }}>
                        <Package size={14} className="muted" /> {review.productName}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                        <User size={13} className="muted" /> {review.customerName}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {renderStars(review.rating)}
                      </div>
                    </td>
                    <td>
                      <p style={{
                        fontSize: '0.85rem',
                        lineHeight: '1.5',
                        color: review.status === 'spam' ? 'var(--accent-danger)' : 'var(--text-primary)',
                        textDecoration: review.status === 'spam' ? 'line-through' : 'none',
                        maxWidth: '400px',
                        wordBreak: 'break-word'
                      }}>
                        {review.comment}
                      </p>
                      {review.images.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                          {review.images.map((img, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setLightbox(img)}
                              title="Büyüt"
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: 'var(--radius-sm)',
                                overflow: 'hidden',
                                border: '1px solid var(--border-color)',
                                padding: 0,
                                cursor: 'zoom-in',
                                background: 'var(--bg-tertiary)',
                                flexShrink: 0,
                              }}
                            >
                              <img
                                src={toReachableImageUrl(img)}
                                alt={`Yorum fotoğrafı ${idx + 1}`}
                                loading="lazy"
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              />
                            </button>
                          ))}
                        </div>
                      )}
                      <AiBadge action={review.aiAction} confidence={review.aiConfidence} reason={review.aiReason} />
                    </td>
                    <td>
                      <Badge
                        status={
                          review.status === 'approved'
                            ? { label: 'Onaylı', variant: 'success' }
                            : review.status === 'spam'
                            ? { label: 'Spam', variant: 'danger' }
                            : { label: 'Beklemede', variant: 'warning' }
                        }
                      />
                    </td>
                    <td className="muted" style={{ fontSize: '0.82rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={13} /> {new Date(review.createdAt).toLocaleDateString('tr-TR')}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                        {review.status !== 'approved' && (
                          <button
                            className="btn btn--secondary btn--icon btn--sm"
                            style={{ color: 'var(--accent-success)' }}
                            title="Onayla"
                            onClick={() => handleApprove(review.id)}
                          >
                            <Check size={14} />
                          </button>
                        )}
                        {review.status !== 'spam' && (
                          <button
                            className="btn btn--secondary btn--icon btn--sm"
                            style={{ color: 'var(--accent-warning)' }}
                            title="Spam Olarak İşaretle"
                            onClick={() => handleSpam(review.id)}
                          >
                            <AlertTriangle size={14} />
                          </button>
                        )}
                        <button
                          className="btn btn--danger btn--icon btn--sm"
                          title="Sil"
                          onClick={() => handleDelete(review.id)}
                        >
                          <Trash2 size={14} />
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
