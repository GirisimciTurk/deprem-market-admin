import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { MessageCircleQuestion, Package, Store, EyeOff, RotateCcw, Trash2 } from 'lucide-react'
import Header from '../../components/layout/Header'
import Badge from '../../components/ui/Badge'
import Pagination from '../../components/ui/Pagination'
import { LoadingState } from '../../components/ui/Spinner'
import { EmptyState, ErrorState } from '../../components/ui/StateBox'
import { useToast } from '../../components/ui/toast-context'
import { api } from '../../lib/api'
import type { StatusMeta } from '../../lib/statusLabels'
import { formatDate } from '../../lib/format'

const LIMIT = 20

const STATUS_OPTIONS = [
  { value: '', label: 'Tümü' },
  { value: 'answered', label: 'Yanıtlanan (Yayında)' },
  { value: 'pending', label: 'Yanıt Bekleyen' },
  { value: 'rejected', label: 'Reddedilen' },
]

function qStatus(status: string): StatusMeta {
  if (status === 'answered') return { label: 'Yayında', variant: 'success' }
  if (status === 'rejected') return { label: 'Reddedildi', variant: 'danger' }
  return { label: 'Yanıt Bekliyor', variant: 'warning' }
}

interface AdminQuestion {
  id: string
  product_id: string
  product_title: string
  customer_name: string
  customer_email?: string | null
  question: string
  answer?: string | null
  status: string
  created_at: string
  answered_at?: string | null
  seller?: { id: string; name: string } | null
}

interface QuestionsResponse {
  questions: AdminQuestion[]
  count: number
  offset: number
  limit: number
}

export default function Questions() {
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const [offset, setOffset] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['product-questions', offset, statusFilter],
    queryFn: () =>
      api.get<QuestionsResponse>('/admin/product-questions', {
        limit: LIMIT,
        offset,
        status: statusFilter || undefined,
      }),
    placeholderData: keepPreviousData,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['product-questions'] })

  const moderate = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'reject' | 'restore' }) =>
      api.post(`/admin/product-questions/${id}`, { action }),
    onSuccess: (_r, vars) => {
      notify(vars.action === 'reject' ? 'Soru gizlendi.' : 'Soru geri alındı.')
      refresh()
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/product-questions/${id}`),
    onSuccess: () => {
      notify('Soru kalıcı olarak silindi.')
      refresh()
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const busy = moderate.isPending || remove.isPending
  const questions = data?.questions ?? []

  return (
    <>
      <Header title="Sorular" subtitle="Ürün sorularını ve satıcı yanıtlarını moderasyon" />
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setOffset(0)
            }}
            style={{ width: 'auto', minWidth: 200 }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <LoadingState label="Sorular yükleniyor..." />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : questions.length === 0 ? (
          <EmptyState
            icon={<MessageCircleQuestion size={26} />}
            title="Soru yok"
            description="Bu duruma uygun ürün sorusu bulunmuyor."
          />
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: isFetching ? 0.6 : 1 }}>
              {questions.map((q) => (
                <div key={q.id} className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.82rem' }} className="muted">
                      <Package size={14} /> {q.product_title}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.82rem' }} className="muted">
                      <Store size={13} /> {q.seller?.name ?? '—'}
                    </span>
                    <Badge status={qStatus(q.status)} />
                    <span className="muted" style={{ marginLeft: 'auto', fontSize: '0.78rem' }}>
                      {q.customer_name} · {formatDate(q.created_at)}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.95rem', fontWeight: 500, marginBottom: q.answer ? 8 : 0 }}>
                    {q.question}
                  </div>
                  {q.answer && (
                    <div
                      style={{
                        background: 'var(--bg-tertiary)',
                        borderLeft: '3px solid var(--accent-success)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '10px 14px',
                        fontSize: '0.88rem',
                      }}
                    >
                      <strong>Satıcı yanıtı: </strong>
                      {q.answer}
                    </div>
                  )}

                  <div className="row-actions" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
                    {q.status !== 'rejected' ? (
                      <button
                        className="btn btn--secondary btn--sm"
                        style={{ color: 'var(--accent-danger)' }}
                        disabled={busy}
                        onClick={() => moderate.mutate({ id: q.id, action: 'reject' })}
                      >
                        <EyeOff size={14} /> Gizle
                      </button>
                    ) : (
                      <button
                        className="btn btn--secondary btn--sm"
                        disabled={busy}
                        onClick={() => moderate.mutate({ id: q.id, action: 'restore' })}
                      >
                        <RotateCcw size={14} /> Geri Al
                      </button>
                    )}
                    <button
                      className="btn btn--secondary btn--sm"
                      style={{ color: 'var(--accent-danger)' }}
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm('Bu soru kalıcı olarak silinsin mi?')) remove.mutate(q.id)
                      }}
                    >
                      <Trash2 size={14} /> Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <Pagination offset={offset} limit={LIMIT} count={data?.count ?? 0} onChange={setOffset} />
          </>
        )}
      </div>
    </>
  )
}
