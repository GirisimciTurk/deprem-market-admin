import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  Star,
  Search,
  Check,
  AlertTriangle,
  Clock,
  Trash2,
  Store,
  User,
  Calendar,
} from 'lucide-react'
import Header from '../../components/layout/Header'
import Badge from '../../components/ui/Badge'
import Pagination from '../../components/ui/Pagination'
import { LoadingState } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/StateBox'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useToast } from '../../components/ui/toast-context'
import { useDebounce } from '../../lib/useDebounce'
import { api } from '../../lib/api'
import { sellerReviewStatus } from '../../lib/statusLabels'

const LIMIT = 20

type ReviewStatus = 'pending' | 'approved' | 'spam'

interface SellerReview {
  id: string
  rating: number
  comment: string
  status: ReviewStatus
  customer_name: string | null
  customer_id: string | null
  order_id: string | null
  created_at: string
  seller: { id: string; name: string; handle: string } | null
}

interface SellerReviewsResponse {
  reviews: SellerReview[]
  count: number
  offset: number
  limit: number
}

export default function SellerReviews() {
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [deleteTarget, setDeleteTarget] = useState<SellerReview | null>(null)
  const debounced = useDebounce(search)

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['seller-reviews', offset, debounced, statusFilter],
    queryFn: () =>
      api.get<SellerReviewsResponse>('/admin/seller-reviews', {
        limit: LIMIT,
        offset,
        q: debounced || undefined,
        status: statusFilter || undefined,
      }),
    placeholderData: keepPreviousData,
  })

  const reviews = data?.reviews ?? []

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReviewStatus }) =>
      api.post(`/admin/seller-reviews/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seller-reviews'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/seller-reviews/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seller-reviews'] }),
  })

  const handleApprove = async (id: string) => {
    try {
      await statusMutation.mutateAsync({ id, status: 'approved' })
      notify('Değerlendirme yayınlandı.', 'success')
    } catch {
      notify('İşlem başarısız oldu.', 'error')
    }
  }

  const handleSpam = async (id: string) => {
    try {
      await statusMutation.mutateAsync({ id, status: 'spam' })
      notify('Değerlendirme spam olarak işaretlendi.', 'info')
    } catch {
      notify('İşlem başarısız oldu.', 'error')
    }
  }

  const handlePending = async (id: string) => {
    try {
      await statusMutation.mutateAsync({ id, status: 'pending' })
      notify('Değerlendirme beklemeye alındı.', 'info')
    } catch {
      notify('İşlem başarısız oldu.', 'error')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      notify('Değerlendirme silindi.')
      setDeleteTarget(null)
    } catch {
      notify('Silme işlemi başarısız oldu.', 'error')
    }
  }

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        size={14}
        style={{
          fill: i < rating ? 'var(--accent-warning)' : 'none',
          color: i < rating ? 'var(--accent-warning)' : 'var(--text-tertiary)',
          marginRight: '2px',
        }}
      />
    ))
  }

  return (
    <>
      <Header title="Satıcı Değerlendirmeleri" subtitle="Satıcılara yapılan değerlendirmeleri moderasyon edin" />

      <div style={{ padding: '24px' }}>
        {/* Filter bar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div className="header__search" style={{ flex: 1, minWidth: '220px' }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Satıcı, müşteri veya yorum içeriği ara..."
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
            <option value="approved">Yayında Olanlar</option>
            <option value="spam">Spam Olarak İşaretlenenler</option>
          </select>
        </div>

        {/* Content list */}
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState message="Değerlendirmeler yüklenemedi." onRetry={() => refetch()} />
        ) : reviews.length === 0 ? (
          <EmptyState
            icon={<Star size={26} />}
            title="Değerlendirme bulunamadı"
            description={debounced || statusFilter ? 'Filtreye uygun değerlendirme yok.' : 'Henüz hiç satıcı değerlendirmesi yapılmamış.'}
          />
        ) : (
          <>
            <div className="table-container animate-fadeIn" style={{ opacity: isFetching ? 0.7 : 1 }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '220px' }}>Satıcı</th>
                    <th style={{ width: '150px' }}>Müşteri</th>
                    <th style={{ width: '120px' }}>Puan</th>
                    <th>Yorum</th>
                    <th style={{ width: '120px' }}>Durum</th>
                    <th style={{ width: '140px' }}>Tarih</th>
                    <th style={{ width: '140px', textAlign: 'right' }}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((review) => (
                    <tr key={review.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.85rem' }}>
                          <Store size={14} className="muted" /> {review.seller?.name ?? '—'}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                          <User size={13} className="muted" /> {review.customer_name || '—'}
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
                          wordBreak: 'break-word',
                        }}>
                          {review.comment}
                        </p>
                      </td>
                      <td>
                        <Badge status={sellerReviewStatus(review.status)} />
                      </td>
                      <td className="muted" style={{ fontSize: '0.82rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={13} /> {new Date(review.created_at).toLocaleDateString('tr-TR')}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                          {review.status !== 'approved' && (
                            <button
                              className="btn btn--secondary btn--icon btn--sm"
                              style={{ color: 'var(--accent-success)' }}
                              title="Yayınla"
                              onClick={() => handleApprove(review.id)}
                            >
                              <Check size={14} />
                            </button>
                          )}
                          {review.status !== 'pending' && (
                            <button
                              className="btn btn--secondary btn--icon btn--sm"
                              style={{ color: 'var(--accent-warning)' }}
                              title="Beklet"
                              onClick={() => handlePending(review.id)}
                            >
                              <Clock size={14} />
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
                            onClick={() => setDeleteTarget(review)}
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

      {deleteTarget && (
        <ConfirmDialog
          title="Değerlendirmeyi Sil"
          message="Bu değerlendirmeyi kalıcı olarak silmek istediğinize emin misiniz?"
          confirmLabel="Sil"
          danger
          loading={deleteMutation.isPending}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
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
