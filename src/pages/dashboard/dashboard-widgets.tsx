import { TrendingUp, TrendingDown } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { COLORS, type ChartPoint } from './dashboard-utils'

/** Üst metrik kartı (ciro, sipariş, sepet ort., müşteri). */
export function StatCard({
  title,
  value,
  change,
  trend,
  icon,
  color,
  showChange,
}: {
  title: string
  value: string
  change: string
  trend: 'up' | 'down'
  icon: React.ReactNode
  color: string
  showChange: boolean
}) {
  return (
    <div className={`stat-card stat-card--${color} animate-fadeIn`}>
      <div className="stat-card__header">
        <span className="stat-card__title">{title}</span>
        <div className="stat-card__icon">{icon}</div>
      </div>
      <div className="stat-card__value">{value}</div>
      {showChange && change !== '—' && (
        <div className={`stat-card__change stat-card__change--${trend}`}>
          {trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span>{change} {title === 'Toplam Müşteri' ? `yeni (${value === '0' ? '' : ''}bu dönem)` : 'geçen döneme göre'}</span>
        </div>
      )}
    </div>
  )
}

/** Ciro & sipariş alan grafiği (zaman ekseninde). */
export function RevenueChart({
  data,
  rangeLabel,
  revChange,
}: {
  data: ChartPoint[]
  rangeLabel: string
  revChange: { change: string; trend: 'up' | 'down' }
}) {
  return (
    <div className="card dashboard__chart-card">
      <div className="dashboard__chart-header">
        <div>
          <h3>Ciro & Sipariş Analizi</h3>
          <p className="chart-subtitle">{rangeLabel} — gerçek sipariş verisi</p>
        </div>
        <span className={`badge ${revChange.trend === 'up' ? 'badge--success' : 'badge--danger'}`}>
          {revChange.trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {revChange.change}
        </span>
      </div>
      <div className="dashboard__chart">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₺${v.toLocaleString('tr-TR')}`} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'var(--text-primary)' }}
              formatter={(value: any, _n: any, p: any) => [`₺${Number(value).toLocaleString('tr-TR')} • ${p?.payload?.orders ?? 0} sipariş`, 'Gelir']}
            />
            <Area type="monotone" dataKey="value" stroke="var(--accent-primary)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorValue)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Sipariş durum dağılımı donut grafiği + lejant. */
export function StatusDonut({
  data,
  rangeLabel,
}: {
  data: { name: string; value: number }[]
  rangeLabel: string
}) {
  return (
    <div className="card dashboard__chart-card">
      <div className="dashboard__chart-header">
        <div>
          <h3>Sipariş Durum Dağılımı</h3>
          <p className="chart-subtitle">{rangeLabel} içindeki siparişler</p>
        </div>
      </div>
      <div className="dashboard__chart donut-chart-container">
        {data.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220, color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
            Bu dönemde sipariş yok.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={65} outerRadius={85} paddingAngle={3} dataKey="value">
                  {data.map((_e, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v} sipariş`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-legend">
              {data.map((cat, index) => (
                <div key={index} className="donut-legend__item">
                  <span className="donut-legend__bullet" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                  <span className="donut-legend__name">{cat.name}</span>
                  <span className="donut-legend__percentage">{cat.value}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
