import { useState, type ReactNode } from 'react'
import { toReachableImageUrl } from '../../lib/image-url'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Store,
  Home,
  Star,
  Wallet,
  Package,
  Undo2,
  Check,
  Ban,
  Info,
  Award,
} from 'lucide-react'
import Header from '../../components/layout/Header'
import Badge from '../../components/ui/Badge'
import { LoadingState } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/StateBox'
import { useToast } from '../../components/ui/toast-context'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'
import type { StatusMeta } from '../../lib/statusLabels'
import type { SellerStatus, SellerDetailResponse } from './seller-detail-types'
import { OverviewTab } from './seller-overview-tab'
import { PerformanceTab } from './seller-performance-tab'
import { SettingsTab } from './seller-settings-tab'
import { OrdersTab } from './seller-orders-tab'
import { ProductsTab } from './seller-products-tab'
import { ReviewsTab } from './seller-reviews-tab'
import { ReturnsTab } from './seller-returns-tab'

function statusBadge(status: SellerStatus): StatusMeta {
  if (status === 'active') return { label: 'Aktif', variant: 'success' }
  if (status === 'suspended') return { label: 'Askıda', variant: 'danger' }
  return { label: 'Beklemede', variant: 'warning' }
}

type Tab = 'overview' | 'performance' | 'settings' | 'orders' | 'products' | 'reviews' | 'returns'

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'overview', label: 'Genel Bakış', icon: <Store size={15} /> },
  { id: 'performance', label: 'Karne & Analitik', icon: <Award size={15} /> },
  { id: 'settings', label: 'Bilgiler & Ayarlar', icon: <Info size={15} /> },
  { id: 'orders', label: 'Siparişler & Ödeme', icon: <Wallet size={15} /> },
  { id: 'products', label: 'Ürünler', icon: <Package size={15} /> },
  { id: 'reviews', label: 'Değerlendirmeler', icon: <Star size={15} /> },
  { id: 'returns', label: 'İadeler', icon: <Undo2 size={15} /> },
]

export default function SellerDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { notify } = useToast()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('overview')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['seller-detail', id],
    queryFn: () => api.get<SellerDetailResponse>(`/admin/sellers/${id}`),
    enabled: !!id,
  })

  const statusMutation = useMutation({
    mutationFn: (status: SellerStatus) => api.post(`/admin/sellers/${id}`, { status }),
    onSuccess: (_r, status) => {
      notify(status === 'active' ? 'Satıcı aktifleştirildi.' : status === 'suspended' ? 'Satıcı askıya alındı.' : 'Güncellendi.')
      qc.invalidateQueries({ queryKey: ['seller-detail', id] })
      qc.invalidateQueries({ queryKey: ['sellers'] })
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  if (isLoading) {
    return (
      <>
        <Header title="Satıcı Detayı" subtitle="Yükleniyor..." />
        <div style={{ padding: '24px' }}><LoadingState label="Satıcı verisi yükleniyor..." /></div>
      </>
    )
  }
  if (isError || !data) {
    return (
      <>
        <Header title="Satıcı Detayı" />
        <div style={{ padding: '24px' }}>
          <button className="btn btn--secondary" onClick={() => navigate('/sellers')} style={{ marginBottom: 16 }}>
            <ArrowLeft size={16} /> Satıcılara Dön
          </button>
          <ErrorState message={(error as Error)?.message || 'Satıcı yüklenemedi.'} onRetry={() => refetch()} />
        </div>
      </>
    )
  }

  const s = data.seller
  const cur = data.payout.currency_code
  const rating = data.review_stats.rating_avg

  return (
    <>
      <Header title={s.name} subtitle={`Satıcı yönetimi · /${s.handle}`} />

      <div style={{ padding: '24px' }}>
        {/* Back + identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button className="btn btn--secondary btn--sm" onClick={() => navigate('/sellers')}>
            <ArrowLeft size={15} /> Satıcılar
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            }}>
              {s.logo ? <img src={toReachableImageUrl(s.logo)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : s.is_house ? <Home size={20} className="muted" /> : <Store size={20} className="muted" />}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {s.name}
                <Badge status={statusBadge(s.status)} />
                {s.is_house && <Badge status={{ label: 'Ana Mağaza', variant: 'info' }} />}
              </div>
              <div className="muted" style={{ fontSize: '0.8rem' }}>
                {rating != null ? <><Star size={11} style={{ fill: 'var(--accent-warning)', color: 'var(--accent-warning)', verticalAlign: 'middle' }} /> {rating.toFixed(1)} ({data.review_stats.rating_count}) · </> : ''}
                Komisyon %{s.commission_rate} · Kayıt {formatDate(s.created_at)}
              </div>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            {s.status !== 'active' && (
              <button className="btn btn--primary btn--sm" onClick={() => statusMutation.mutate('active')} disabled={statusMutation.isPending}>
                <Check size={15} /> Aktifleştir
              </button>
            )}
            {s.status === 'active' && !s.is_house && (
              <button className="btn btn--secondary btn--sm" style={{ color: 'var(--accent-warning)' }}
                onClick={() => { if (window.confirm('Satıcıyı askıya almak istediğinize emin misiniz? Satışları durur.')) statusMutation.mutate('suspended') }}
                disabled={statusMutation.isPending}>
                <Ban size={15} /> Askıya Al
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-primary)', marginBottom: '24px', flexWrap: 'wrap' }}>
          {TABS.map((t) => {
            const badgeCount = t.id === 'reviews' ? data.review_stats.pending_count
              : t.id === 'returns' ? data.return_stats.requested_count
              : t.id === 'products' ? data.product_stats.proposed : 0
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="btn btn--ghost"
                style={{
                  borderRadius: 0,
                  borderBottom: tab === t.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  color: tab === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: tab === t.id ? 600 : 500,
                  padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                {t.icon} {t.label}
                {badgeCount > 0 && (
                  <span style={{
                    background: 'var(--accent-warning)', color: '#000', borderRadius: '999px',
                    fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', minWidth: 16, textAlign: 'center',
                  }}>{badgeCount}</span>
                )}
              </button>
            )
          })}
        </div>

        {tab === 'overview' && <OverviewTab data={data} cur={cur} />}
        {tab === 'performance' && <PerformanceTab sellerId={id} />}
        {tab === 'settings' && <SettingsTab seller={s} hasLogin={data.has_login} onSaved={() => { qc.invalidateQueries({ queryKey: ['seller-detail', id] }); qc.invalidateQueries({ queryKey: ['sellers'] }) }} />}
        {tab === 'orders' && <OrdersTab sellerId={id} sellerName={s.name} />}
        {tab === 'products' && <ProductsTab products={data.products} />}
        {tab === 'reviews' && <ReviewsTab sellerId={id} />}
        {tab === 'returns' && <ReturnsTab returns={data.recent_returns} />}
      </div>
    </>
  )
}
