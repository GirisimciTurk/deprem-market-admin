import { useState, useMemo, lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { formatMoney } from '../../lib/format'
import {
  ShoppingCart,
  Users,
  DollarSign,
  Clock,
  AlertTriangle,
  MessageSquare,
  RefreshCw,
  Percent,
  Truck,
} from 'lucide-react'
import Header from '../../components/layout/Header'
import {
  type TimeRange,
  type OrderRow,
  type ChartPoint,
  RANGE_LABELS,
  REVENUE_TITLE,
  FULFILLMENT_LABELS,
  isPlaced,
  orderRevenue,
  getWindow,
  getBuckets,
  pct,
  relTime,
} from './dashboard-utils'
import { StatCard } from './dashboard-widgets'
// Grafikler ayrı chunk + lazy → recharts (~327KB) Dashboard'ın ilk render'ını bloklamaz.
const RevenueChart = lazy(() => import('./dashboard-charts').then((m) => ({ default: m.RevenueChart })))
const StatusDonut = lazy(() => import('./dashboard-charts').then((m) => ({ default: m.StatusDonut })))
import './Dashboard.css'

export default function Dashboard() {
  const [range, setRange] = useState<TimeRange>('7days')

  const {
    data: ordersResp,
    refetch: refetchOrders,
    isFetching: ordersFetching,
    isLoading: ordersLoading,
  } = useQuery({
    queryKey: ['dashboard-orders'],
    queryFn: () =>
      api.get<{ orders: OrderRow[]; count: number }>('/admin/orders', {
        fields:
          'id,display_id,email,total,currency_code,created_at,payment_status,fulfillment_status,status,shipping_address.first_name,shipping_address.last_name',
        limit: 1000,
        order: '-created_at',
      }),
  })
  const orders = useMemo(() => ordersResp?.orders ?? [], [ordersResp])

  const { data: customersResp } = useQuery({
    queryKey: ['dashboard-customers'],
    queryFn: () =>
      api.get<{ customers: { id: string; created_at: string }[]; count: number }>(
        '/admin/customers',
        { fields: 'id,created_at', limit: 1000 }
      ),
  })
  const customers = useMemo(() => customersResp?.customers ?? [], [customersResp])
  const customerCount = customersResp?.count ?? customers.length

  const { data: reviewsResp } = useQuery({
    queryKey: ['dashboard-reviews-pending'],
    queryFn: () => api.get<{ count: number }>('/admin/reviews', { status: 'pending', limit: 1 }),
  })
  const pendingReviews = reviewsResp?.count ?? 0

  const { data: productsResponse, refetch: refetchProducts } = useQuery({
    queryKey: ['products-dashboard'],
    queryFn: () =>
      api.get<{ products: any[] }>('/admin/products', {
        fields:
          'id,title,metadata,variants.id,variants.manage_inventory,variants.inventory_items.inventory.location_levels.stocked_quantity,variants.inventory_items.inventory.location_levels.reserved_quantity',
        limit: 200,
      }),
  })
  const realProducts = useMemo(() => productsResponse?.products ?? [], [productsResponse])

  // Stok = tüm lokasyon seviyelerinde (stocked - reserved) toplamı.
  const getProductStock = (product: any): number | null => {
    const tracked = (product.variants ?? []).filter((v: any) => v.manage_inventory)
    if (tracked.length === 0) return null
    let total = 0
    for (const v of tracked) {
      for (const ii of v.inventory_items ?? []) {
        for (const lvl of ii.inventory?.location_levels ?? []) {
          total += (lvl.stocked_quantity ?? 0) - (lvl.reserved_quantity ?? 0)
        }
      }
    }
    return total
  }

  const lowStockProducts = useMemo(() => {
    const list: { id: string; name: string; stock: number; threshold: number }[] = []
    realProducts.forEach((p) => {
      const stock = getProductStock(p)
      if (stock === null) return
      const threshold = Number(p.metadata?.critical_threshold) || 10
      if (stock <= threshold) list.push({ id: p.id, name: p.title, stock, threshold })
    })
    return list.sort((a, b) => a.stock - b.stock)
  }, [realProducts])

  // ─── Tüm metrikler gerçek siparişlerden hesaplanır ────────────────
  const m = useMemo(() => {
    const now = new Date()
    const { start, end, prevStart, prevEnd } = getWindow(range, now)

    const inRange = orders.filter((o) => {
      const d = new Date(o.created_at)
      return d >= start && d <= end && isPlaced(o)
    })
    const inPrev =
      prevStart && prevEnd
        ? orders.filter((o) => {
            const d = new Date(o.created_at)
            return d >= prevStart && d < prevEnd && isPlaced(o)
          })
        : []

    const revenue = inRange.reduce((s, o) => s + orderRevenue(o), 0)
    const prevRevenue = inPrev.reduce((s, o) => s + orderRevenue(o), 0)
    const count = inRange.length
    const avg = count > 0 ? revenue / count : 0
    const prevAvg = inPrev.length > 0 ? prevRevenue / inPrev.length : 0

    // Yeni müşteriler (seçili pencerede)
    const newCustomers = customers.filter((c) => {
      const d = new Date(c.created_at)
      return d >= start && d <= end
    }).length

    // Kargodaki siparişler (anlık)
    const inTransit = orders.filter(
      (o) => o.fulfillment_status === 'shipped' || o.fulfillment_status === 'partially_shipped'
    ).length

    // Grafik
    const firstOrder = orders.length ? new Date(orders[orders.length - 1].created_at) : null
    const buckets = getBuckets(range, now, firstOrder)
    const chart: ChartPoint[] = buckets.map((b, i) => {
      const next = buckets[i + 1]?.start ?? new Date(end.getTime() + 1)
      const inBucket = inRange.filter((o) => {
        const d = new Date(o.created_at)
        return d >= b.start && d < next
      })
      return {
        name: b.label,
        value: Math.round(inBucket.reduce((s, o) => s + orderRevenue(o), 0)),
        orders: inBucket.length,
      }
    })

    // Sipariş durum dağılımı (donut) — pencere içi
    const statusCounts: Record<string, number> = {}
    inRange.forEach((o) => {
      const key = o.fulfillment_status || 'not_fulfilled'
      statusCounts[key] = (statusCounts[key] || 0) + 1
    })
    const statusShare = Object.entries(statusCounts)
      .map(([k, v]) => ({ name: FULFILLMENT_LABELS[k] || k, value: v }))
      .sort((a, b) => b.value - a.value)

    return {
      revenue,
      count,
      avg,
      newCustomers,
      inTransit,
      chart,
      statusShare,
      revChange: pct(revenue, prevRevenue),
      countChange: pct(count, inPrev.length),
      avgChange: pct(avg, prevAvg),
      hasPrev: prevStart !== null,
      recent: inRange.slice(0, 5),
    }
  }, [range, orders, customers])

  // ─── Türetilmiş gerçek aktivite akışı ─────────────────────────────
  const activities = useMemo(() => {
    const items: { id: string; text: string; status: string; time: string }[] = []
    orders.slice(0, 3).forEach((o) => {
      items.push({
        id: `o-${o.id}`,
        text: `Yeni sipariş #${o.display_id} (${formatMoney(o.total, o.currency_code)})`,
        status: 'success',
        time: relTime(o.created_at),
      })
    })
    if (pendingReviews > 0) {
      items.push({
        id: 'rev',
        text: `${pendingReviews} ürün yorumu onay bekliyor`,
        status: 'warning',
        time: 'şimdi',
      })
    }
    lowStockProducts.slice(0, 2).forEach((p) => {
      items.push({
        id: `s-${p.id}`,
        text: `Kritik stok: ${p.name} (kalan: ${p.stock})`,
        status: 'danger',
        time: 'şimdi',
      })
    })
    return items
  }, [orders, pendingReviews, lowStockProducts])

  const handleRefresh = () => {
    refetchOrders()
    refetchProducts()
  }

  const stats = [
    {
      title: REVENUE_TITLE[range],
      value: formatMoney(Math.round(m.revenue * 100), 'try'),
      change: m.revChange.change,
      trend: m.revChange.trend,
      icon: <DollarSign size={20} />,
      color: 'primary',
    },
    {
      title: 'Sipariş Sayısı',
      value: String(m.count),
      change: m.countChange.change,
      trend: m.countChange.trend,
      icon: <ShoppingCart size={20} />,
      color: 'success',
    },
    {
      title: 'Sepet Ortalaması',
      value: formatMoney(Math.round(m.avg * 100), 'try'),
      change: m.avgChange.change,
      trend: m.avgChange.trend,
      icon: <Percent size={20} />,
      color: 'info',
    },
    {
      title: 'Toplam Müşteri',
      value: String(customerCount),
      change: `+${m.newCustomers}`,
      trend: 'up' as const,
      icon: <Users size={20} />,
      color: 'warning',
    },
  ]

  return (
    <>
      <Header title="Dashboard" subtitle="Gerçek zamanlı operasyonel durum paneli ve istatistikleri" />
      <div className="dashboard">
        <div className="dashboard__controls animate-fadeIn">
          <div className="dashboard__filter-group">
            {(Object.keys(RANGE_LABELS) as TimeRange[]).map((r) => (
              <button
                key={r}
                className={`dashboard__filter-btn ${range === r ? 'active' : ''}`}
                onClick={() => setRange(r)}
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>
          <button
            className={`btn btn--secondary btn--sm ${ordersFetching ? 'refresh-spin' : ''}`}
            onClick={handleRefresh}
          >
            <RefreshCw size={14} /> Yenile
          </button>
        </div>

        {/* Primary Stats */}
        <div className="dashboard__stats">
          {stats.map((stat, i) => (
            <StatCard key={i} {...stat} showChange={m.hasPrev || stat.title === 'Toplam Müşteri'} />
          ))}
        </div>

        {/* Secondary Info */}
        <div className="dashboard__sub-stats animate-fadeIn">
          <div className="sub-stat-card">
            <div className="sub-stat-card__icon text-primary"><Users size={16} /></div>
            <div>
              <span className="sub-stat-card__label">Yeni Müşteriler ({RANGE_LABELS[range]})</span>
              <span className="sub-stat-card__val">+{m.newCustomers}</span>
            </div>
          </div>
          <div className="sub-stat-card">
            <div className="sub-stat-card__icon text-warning"><AlertTriangle size={16} /></div>
            <div>
              <span className="sub-stat-card__label">Düşük Stok Uyarıları</span>
              <span className="sub-stat-card__val">{lowStockProducts.length} Ürün</span>
            </div>
          </div>
          <div className="sub-stat-card">
            <div className="sub-stat-card__icon text-info"><Truck size={16} /></div>
            <div>
              <span className="sub-stat-card__label">Kargodaki Siparişler</span>
              <span className="sub-stat-card__val">{m.inTransit}</span>
            </div>
          </div>
          <div className="sub-stat-card">
            <div className="sub-stat-card__icon text-success"><MessageSquare size={16} /></div>
            <div>
              <span className="sub-stat-card__label">Bekleyen Yorumlar</span>
              <span className="sub-stat-card__val">{pendingReviews} Yorum</span>
            </div>
          </div>
        </div>

        {/* Charts — recharts lazy yüklenir; kartlar/tablo önce render olur */}
        <Suspense fallback={<div className="dashboard__charts"><div className="card dashboard__chart-card" style={{ minHeight: 320 }} /><div className="card dashboard__chart-card" style={{ minHeight: 320 }} /></div>}>
          <div className="dashboard__charts">
            <RevenueChart data={m.chart} rangeLabel={RANGE_LABELS[range]} revChange={m.revChange} />
            <StatusDonut data={m.statusShare} rangeLabel={RANGE_LABELS[range]} />
          </div>
        </Suspense>

        {/* Action Center */}
        <div className="dashboard__action-grid animate-fadeIn">
          {/* Recent Orders (real) */}
          <div className="card dashboard__table-card">
            <div className="dashboard__section-header">
              <div>
                <h3>Son Siparişler</h3>
                <p className="card-subtitle">{RANGE_LABELS[range]} içindeki son siparişler</p>
              </div>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Sipariş</th>
                    <th>Müşteri</th>
                    <th>Tutar</th>
                    <th>Durum</th>
                    <th>Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersLoading ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)' }}>Yükleniyor…</td></tr>
                  ) : m.recent.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)' }}>Bu dönemde sipariş yok.</td></tr>
                  ) : (
                    m.recent.map((o) => (
                      <tr key={o.id}>
                        <td><strong>#{o.display_id}</strong></td>
                        <td>{[o.shipping_address?.first_name, o.shipping_address?.last_name].filter(Boolean).join(' ') || o.email || '-'}</td>
                        <td><strong>{formatMoney(o.total, o.currency_code)}</strong></td>
                        <td><span className="badge badge--info">{FULFILLMENT_LABELS[o.fulfillment_status || 'not_fulfilled'] || o.fulfillment_status}</span></td>
                        <td><span className="dashboard__time"><Clock size={12} /> {relTime(o.created_at)}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Low Stock (real) */}
          <div className="card dashboard__watchlist-card">
            <div className="dashboard__section-header">
              <div>
                <h3>Kritik Stok Uyarıları</h3>
                <p className="card-subtitle">Stok miktarı tükenmek üzere olanlar</p>
              </div>
              {lowStockProducts.length > 0 && <span className="badge badge--danger-light text-danger">Müdahale Gerekli</span>}
            </div>
            <div className="dashboard__watchlist">
              {lowStockProducts.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, padding: '40px 20px', textAlign: 'center' }}>
                  <span style={{ fontSize: '1.5rem' }}>✅</span>
                  <p style={{ fontWeight: 600, fontSize: '0.85rem' }}>Harika! Kritik stok seviyesinde ürün bulunmuyor.</p>
                </div>
              ) : (
                lowStockProducts.slice(0, 5).map((p) => {
                  const percent = p.threshold > 0 ? Math.min(Math.round((p.stock / p.threshold) * 100), 100) : 0
                  return (
                    <div key={p.id} className="watchlist-item">
                      <div className="watchlist-item__header">
                        <span className="watchlist-item__name">{p.name}</span>
                        <span className="watchlist-item__count text-danger">Kalan: {p.stock} (Eşik: {p.threshold})</span>
                      </div>
                      <div className="watchlist-item__progress-bg">
                        <div className="watchlist-item__progress-bar bg-danger" style={{ width: `${percent}%` }}></div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Activity feed (derived from real data) */}
          <div className="card dashboard__logs-card">
            <div className="dashboard__section-header">
              <div>
                <h3>Son Hareketler</h3>
                <p className="card-subtitle">Gerçek verilerden türetilmiş özet</p>
              </div>
              <span className="live-badge"><span className="live-dot"></span> Canlı</span>
            </div>
            <div className="dashboard__logs">
              {activities.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Henüz hareket yok.</div>
              ) : (
                activities.map((log) => (
                  <div key={log.id} className="log-item">
                    <div className="log-item__header">
                      <span className={`log-item__dot log-item__dot--${log.status}`}></span>
                      <p className="log-item__text">{log.text}</p>
                    </div>
                    <span className="log-item__time">{log.time}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

