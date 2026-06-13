import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Tag, Trash2 } from 'lucide-react'
import Header from '../../components/layout/Header'
import Badge from '../../components/ui/Badge'
import Pagination from '../../components/ui/Pagination'
import { LoadingState } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/StateBox'
import { useToast } from '../../components/ui/toast-context'
import { api } from '../../lib/api'
import { formatMoney } from '../../lib/format'
import type { StatusMeta } from '../../lib/statusLabels'

interface Campaign {
  id: string
  name: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  status: 'active' | 'ended'
  live_status: 'scheduled' | 'active' | 'expired' | 'ended'
  starts_at: string | null
  ends_at: string | null
  variant_count: number
  product_ids: { id: string; title: string }[] | null
  created_at: string
  seller: { id: string; name: string; handle: string } | null
}

const LIMIT = 50

function liveBadge(s: string): StatusMeta {
  if (s === 'active') return { label: 'Yürürlükte', variant: 'success' }
  if (s === 'scheduled') return { label: 'Zamanlanmış', variant: 'warning' }
  if (s === 'expired') return { label: 'Süresi Doldu', variant: 'neutral' }
  return { label: 'Bitti', variant: 'neutral' }
}

function discountLabel(c: Campaign): string {
  return c.discount_type === 'percentage'
    ? `%${c.discount_value}`
    : formatMoney(c.discount_value)
}

export default function SellerCampaigns() {
  const qc = useQueryClient()
  const { notify } = useToast()
  const [status, setStatus] = useState('')
  const [offset, setOffset] = useState(0)

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['seller-campaigns', status, offset],
    queryFn: () =>
      api.get<{ campaigns: Campaign[]; count: number }>('/admin/seller-campaigns', {
        status: status || undefined,
        limit: LIMIT,
        offset,
      }),
    placeholderData: keepPreviousData,
  })

  const endM = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/seller-campaigns/${id}`),
    onSuccess: () => {
      notify('Kampanya bitirildi.')
      qc.invalidateQueries({ queryKey: ['seller-campaigns'] })
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const campaigns = data?.campaigns ?? []

  return (
    <>
      <Header title="Kampanyalar" subtitle="Satıcı indirim kampanyalarını izleyin ve denetleyin" />
      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0) }} style={{ width: 'auto', minWidth: 180 }}>
            <option value="">Tüm Durumlar</option>
            <option value="active">Yürürlükte</option>
            <option value="scheduled">Zamanlanmış</option>
            <option value="expired">Süresi Doldu</option>
            <option value="ended">Bitti</option>
          </select>
        </div>

        {isLoading ? (
          <LoadingState label="Kampanyalar yükleniyor..." />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : campaigns.length === 0 ? (
          <div className="card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
            <Tag size={26} style={{ marginBottom: 8 }} />
            <div>{status ? 'Bu duruma uygun kampanya yok.' : 'Henüz kampanya yok.'}</div>
          </div>
        ) : (
          <>
            <div className="table-container animate-fadeIn" style={{ opacity: isFetching ? 0.7 : 1 }}>
              <table>
                <thead>
                  <tr>
                    <th>Kampanya</th>
                    <th>Satıcı</th>
                    <th>İndirim</th>
                    <th style={{ textAlign: 'right' }}>Varyant</th>
                    <th>Tarih</th>
                    <th>Durum</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td>
                        {c.seller ? (
                          <Link to={`/sellers/${c.seller.id}`} style={{ color: 'var(--accent-primary)' }}>
                            {c.seller.name}
                          </Link>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="nowrap" style={{ fontWeight: 600 }}>{discountLabel(c)}</td>
                      <td className="nowrap" style={{ textAlign: 'right' }}>{c.variant_count}</td>
                      <td className="muted nowrap" style={{ fontSize: '0.8rem' }}>
                        {c.starts_at ? new Date(c.starts_at).toLocaleDateString('tr-TR') : 'Hemen'}
                        {' → '}
                        {c.ends_at ? new Date(c.ends_at).toLocaleDateString('tr-TR') : 'Süresiz'}
                      </td>
                      <td><Badge status={liveBadge(c.live_status)} /></td>
                      <td style={{ textAlign: 'right' }}>
                        {c.status !== 'ended' && (
                          <button
                            className="btn btn--icon btn--ghost"
                            title="Kampanyayı bitir (gözetim)"
                            disabled={endM.isPending}
                            onClick={() => {
                              if (window.confirm(`"${c.name}" kampanyasını bitir? Fiyatlar normale döner.`)) endM.mutate(c.id)
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
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
