import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { Eye, ShoppingCart, CreditCard, PackageCheck, Users, TrendingUp, Search, Filter } from 'lucide-react'
import Header from '../../components/layout/Header'
import { LoadingState } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/StateBox'
import { api } from '../../lib/api'
import { formatMoney } from '../../lib/format'
import AnalyticsSegments from './analytics-segments'

interface FunnelStep { step: string; key: string; count: number; rate_from_top: number }
interface DailyPoint { date: string; views: number; carts: number; purchases: number; revenue: number }
interface ProductRow { product_id: string; views: number; sessions?: number; title: string; thumbnail: string | null; handle: string | null }
interface SearchRow { query: string; count: number }

interface OverviewResponse {
  range_days: number
  totals: {
    views: number
    add_to_cart: number
    checkout_start: number
    purchases: number
    revenue: number
    unique_sessions: number
    unique_customers: number
  }
  funnel: FunnelStep[]
  conversion_rate: number
  cart_abandon_rate: number
  daily: DailyPoint[]
  top_viewed: ProductRow[]
  viewed_not_bought: ProductRow[]
  top_searches: SearchRow[]
  no_result_searches: SearchRow[]
}

export default function Analytics() {
  const [days, setDays] = useState(30)

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['analytics-overview', days],
    queryFn: () => api.get<OverviewResponse>('/admin/analytics/overview', { days }),
    placeholderData: keepPreviousData,
  })

  return (
    <>
      <Header title="Davranış Analitiği" subtitle="Müşteri davranışı · funnel, ürün ilgisi, arama" />
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: 'auto', minWidth: 140 }}>
            <option value={7}>Son 7 gün</option>
            <option value={30}>Son 30 gün</option>
            <option value={90}>Son 90 gün</option>
          </select>
        </div>

        {isLoading ? <LoadingState label="Analitik yükleniyor..." />
          : isError ? <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
          : !data ? null
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, opacity: isFetching ? 0.7 : 1 }}>
              {/* KPI'lar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                <Kpi icon={<Eye size={18} />} label="Görüntüleme" value={data.totals.views.toLocaleString('tr-TR')} />
                <Kpi icon={<ShoppingCart size={18} />} label="Sepete Ekleme" value={data.totals.add_to_cart.toLocaleString('tr-TR')} />
                <Kpi icon={<CreditCard size={18} />} label="Ödemeye Geçiş" value={data.totals.checkout_start.toLocaleString('tr-TR')} />
                <Kpi icon={<PackageCheck size={18} />} label="Satın Alma" value={data.totals.purchases.toLocaleString('tr-TR')} />
                <Kpi icon={<TrendingUp size={18} />} label="Ciro (izlenen)" value={formatMoney(data.totals.revenue, 'try')} highlight />
                <Kpi icon={<Users size={18} />} label="Tekil Ziyaretçi" value={data.totals.unique_sessions.toLocaleString('tr-TR')}
                  sub={`${data.totals.unique_customers.toLocaleString('tr-TR')} üye`} />
                <Kpi icon={<Filter size={18} />} label="Dönüşüm" value={`%${data.conversion_rate}`} sub="ziyaret → satış" />
                <Kpi icon={<ShoppingCart size={18} />} label="Sepet Terk" value={`%${data.cart_abandon_rate}`} sub="eklenip alınmayan" />
              </div>

              {/* Funnel */}
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Filter size={16} /> Dönüşüm Hunisi
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.funnel.map((f, i) => {
                    const prev = i > 0 ? data.funnel[i - 1].count : f.count
                    const stepRate = prev > 0 ? Math.round((f.count / prev) * 1000) / 10 : 0
                    return (
                      <div key={f.key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600 }}>{f.step}</span>
                          <span className="muted">
                            {f.count.toLocaleString('tr-TR')} · genel %{f.rate_from_top}
                            {i > 0 && <span style={{ color: 'var(--accent-warning)' }}> · adım %{stepRate}</span>}
                          </span>
                        </div>
                        <div style={{ height: 22, borderRadius: 6, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                          <div style={{
                            width: `${Math.max(f.rate_from_top, 1.5)}%`, height: '100%',
                            background: 'var(--accent-primary)', borderRadius: 6, transition: 'width .3s',
                          }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Günlük seri */}
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={16} /> Günlük Aktivite
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data.daily}>
                    <defs>
                      <linearGradient id="aView" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="aBuy" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false}
                      tickFormatter={(d: string) => d.slice(5)} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 8, color: 'var(--text-primary)' }}
                      formatter={(v: any, n: any) => [Number(v).toLocaleString('tr-TR'), n === 'views' ? 'Görüntüleme' : n === 'carts' ? 'Sepet' : 'Satış']}
                    />
                    <Area type="monotone" dataKey="views" stroke="var(--accent-primary)" strokeWidth={2} fill="url(#aView)" />
                    <Area type="monotone" dataKey="carts" stroke="#f59e0b" strokeWidth={2} fillOpacity={0} />
                    <Area type="monotone" dataKey="purchases" stroke="#16a34a" strokeWidth={2} fill="url(#aBuy)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Ürün ilgisi */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                <ProductList title="En Çok Görüntülenen" icon={<Eye size={16} />} rows={data.top_viewed} empty="Henüz görüntüleme verisi yok." />
                <ProductList title="Görüntülenip Alınmayan" icon={<ShoppingCart size={16} />} rows={data.viewed_not_bought}
                  empty="Veri yok — ya hepsi satıldı ya da görüntüleme yok." hint="Fırsat: fiyat/stok/öne çıkarma gözden geçir." />
              </div>

              {/* Arama */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                <SearchList title="Popüler Aramalar" icon={<Search size={16} />} rows={data.top_searches} empty="Arama verisi yok." />
                <SearchList title="Sonuçsuz Aramalar" icon={<Search size={16} />} rows={data.no_result_searches}
                  empty="Sonuçsuz arama yok 🎉" hint="Talep var, ürün yok — katalog açığı." danger />
              </div>

              {/* Segmentler & hedefli kampanya */}
              <AnalyticsSegments />
            </div>
          )}
      </div>
    </>
  )
}

function Kpi({ icon, label, value, sub, highlight }: { icon?: React.ReactNode; label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? 'var(--accent-primary-light, var(--bg-tertiary))' : 'var(--bg-secondary)',
      border: highlight ? '1px solid var(--accent-primary)' : '1px solid var(--border-primary)',
      borderRadius: 'var(--radius-md)', padding: '14px 16px',
    }}>
      <div className="muted" style={{ fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: 6 }}>{icon}{label}</div>
      <div style={{ fontWeight: 700, fontSize: '1.15rem', marginTop: 6, color: highlight ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: '0.74rem', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function ProductList({ title, icon, rows, empty, hint }: { title: string; icon: React.ReactNode; rows: ProductRow[]; empty: string; hint?: string }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: hint ? 4 : 14, display: 'flex', alignItems: 'center', gap: 8 }}>{icon} {title}</h3>
      {hint && <p className="muted" style={{ fontSize: '0.76rem', marginBottom: 12 }}>{hint}</p>}
      {rows.length === 0 ? <div className="muted" style={{ fontSize: '0.85rem', padding: '16px 0' }}>{empty}</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r) => (
            <div key={r.product_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 6, overflow: 'hidden', background: 'var(--bg-tertiary)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {r.thumbnail ? <img src={r.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Eye size={14} className="muted" />}
              </div>
              <span style={{ fontSize: '0.85rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
              <span className="muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>{r.views.toLocaleString('tr-TR')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SearchList({ title, icon, rows, empty, hint, danger }: { title: string; icon: React.ReactNode; rows: SearchRow[]; empty: string; hint?: string; danger?: boolean }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: hint ? 4 : 14, display: 'flex', alignItems: 'center', gap: 8 }}>{icon} {title}</h3>
      {hint && <p className="muted" style={{ fontSize: '0.76rem', marginBottom: 12 }}>{hint}</p>}
      {rows.length === 0 ? <div className="muted" style={{ fontSize: '0.85rem', padding: '16px 0' }}>{empty}</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((r) => (
            <div key={r.query} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '4px 0', borderBottom: '1px solid var(--border-primary)' }}>
              <span style={{ color: danger ? 'var(--accent-danger)' : 'var(--text-primary)' }}>{r.query}</span>
              <span className="muted" style={{ fontWeight: 600 }}>{r.count.toLocaleString('tr-TR')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
