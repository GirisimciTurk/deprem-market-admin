import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { MessageSquare, Check, AlertTriangle, Trash2 } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Pagination from '../../components/ui/Pagination'
import { LoadingState } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/StateBox'
import { useToast } from '../../components/ui/toast-context'
import { api } from '../../lib/api'
import type { StatusMeta } from '../../lib/statusLabels'
import type { SellerReviewRow } from './seller-detail-types'

const REVIEW_LIMIT = 20

function reviewBadge(status: string): StatusMeta {
  if (status === 'approved') return { label: 'Onaylı', variant: 'success' }
  if (status === 'spam') return { label: 'Spam', variant: 'danger' }
  return { label: 'Beklemede', variant: 'warning' }
}

export function ReviewsTab({ sellerId }: { sellerId: string }) {
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
