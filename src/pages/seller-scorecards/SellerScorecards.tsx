import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Award, Home } from 'lucide-react'
import Header from '../../components/layout/Header'
import Badge from '../../components/ui/Badge'
import { LoadingState } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/StateBox'
import { api } from '../../lib/api'
import { gradeColor, scoreColor, pctLabel, type ScorecardComparisonRow } from '../../lib/scorecard'
import type { StatusMeta } from '../../lib/statusLabels'

function statusBadge(status: string): StatusMeta {
  if (status === 'active') return { label: 'Aktif', variant: 'success' }
  if (status === 'suspended') return { label: 'Askıda', variant: 'danger' }
  return { label: 'Beklemede', variant: 'warning' }
}

export default function SellerScorecards() {
  const [status, setStatus] = useState('active')
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['seller-scorecards', status],
    queryFn: () =>
      api.get<{ scorecards: ScorecardComparisonRow[]; count: number }>('/admin/seller-scorecards', {
        status: status || undefined,
      }),
  })

  const rows = data?.scorecards ?? []

  return (
    <>
      <Header title="Performans Karneleri" subtitle="Satıcıların performansını karşılaştırın" />
      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 'auto', minWidth: 160 }}>
            <option value="active">Aktif Satıcılar</option>
            <option value="">Tümü</option>
            <option value="pending">Beklemede</option>
            <option value="suspended">Askıda</option>
          </select>
        </div>

        {isLoading ? (
          <LoadingState label="Karneler yükleniyor..." />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <div className="card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
            <Award size={26} style={{ marginBottom: 8 }} />
            <div>Bu filtreye uygun satıcı yok.</div>
          </div>
        ) : (
          <div className="table-container animate-fadeIn">
            <table>
              <thead>
                <tr>
                  <th>Satıcı</th>
                  <th style={{ textAlign: 'center' }}>Skor</th>
                  <th style={{ textAlign: 'center' }}>Not</th>
                  <th style={{ textAlign: 'right' }}>Sipariş</th>
                  <th style={{ textAlign: 'right' }}>Zamanında Kargo</th>
                  <th style={{ textAlign: 'right' }}>Puan</th>
                  <th style={{ textAlign: 'right' }}>İade</th>
                  <th style={{ textAlign: 'right' }}>Soru Yanıt</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.seller_id}>
                    <td>
                      <Link to={`/sellers/${r.seller_id}`} style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {r.is_house && <Home size={13} style={{ color: 'var(--accent-primary)' }} />}
                        {r.name}
                      </Link>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {r.has_data ? (
                        <span style={{ fontWeight: 800, fontSize: '1.05rem', color: scoreColor(r.overall_score) }}>
                          {r.overall_score}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {r.has_data ? (
                        <span style={{ fontWeight: 800, color: gradeColor(r.grade) }}>{r.grade}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="nowrap" style={{ textAlign: 'right' }}>{r.total_orders}</td>
                    <td className="nowrap" style={{ textAlign: 'right' }}>{r.has_data ? pctLabel(r.on_time_rate) : '—'}</td>
                    <td className="nowrap" style={{ textAlign: 'right' }}>
                      {r.rating_count > 0 ? `${r.rating_avg.toFixed(1)} (${r.rating_count})` : '—'}
                    </td>
                    <td className="nowrap" style={{ textAlign: 'right' }}>{r.has_data ? pctLabel(r.return_rate) : '—'}</td>
                    <td className="nowrap" style={{ textAlign: 'right' }}>{r.has_data ? pctLabel(r.answer_rate) : '—'}</td>
                    <td><Badge status={statusBadge(r.status)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
