import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { TrendingUp } from 'lucide-react'
import { LoadingState } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/StateBox'
import { api } from '../../lib/api'
import { ScoreRing, MetricGrid, AnalyticsView } from '../../components/Scorecard'
import type { SellerScorecard, SellerAnalytics } from '../../lib/scorecard'

export function PerformanceTab({ sellerId }: { sellerId: string }) {
  const [days, setDays] = useState(30)
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['seller-scorecard', sellerId, days],
    queryFn: () =>
      api.get<{ scorecard: SellerScorecard; analytics: SellerAnalytics }>(
        `/admin/sellers/${sellerId}/scorecard`,
        { days }
      ),
    placeholderData: keepPreviousData,
  })

  if (isLoading) return <LoadingState label="Karne yükleniyor..." />
  if (isError) return <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
  if (!data) return null

  const { scorecard: sc, analytics: an } = data

  if (!sc.has_data) {
    return (
      <div className="card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
        Bu satıcı için henüz karne oluşturacak sipariş yok.
      </div>
    )
  }

  return (
    <div style={{ opacity: isFetching ? 0.7 : 1 }}>
      <ScoreRing sc={sc} />
      <MetricGrid sc={sc} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 0 14px', flexWrap: 'wrap', gap: 10 }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={18} /> Satış Analitiği
        </h3>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: 'auto', minWidth: 120 }}>
          <option value={7}>Son 7 gün</option>
          <option value={30}>Son 30 gün</option>
          <option value={90}>Son 90 gün</option>
        </select>
      </div>
      <AnalyticsView an={an} />
    </div>
  )
}
