import { TrendingUp, TrendingDown } from 'lucide-react'

/* Grafikler (recharts) dashboard-charts.tsx'e taşındı (lazy yüklenir). Burada
 * yalnızca hafif, recharts'sız üst metrik kartı kalır. */

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
