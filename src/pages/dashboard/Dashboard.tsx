import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Users,
  DollarSign,
  Package,
  ArrowUpRight,
  Clock,
  Eye,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'
import Header from '../../components/layout/Header'
import './Dashboard.css'

const revenueData = [
  { name: 'Oca', value: 18500 },
  { name: 'Şub', value: 22300 },
  { name: 'Mar', value: 19800 },
  { name: 'Nis', value: 27600 },
  { name: 'May', value: 31200 },
  { name: 'Haz', value: 28900 },
  { name: 'Tem', value: 35400 },
]

const ordersByDay = [
  { name: 'Pzt', orders: 12 },
  { name: 'Sal', orders: 19 },
  { name: 'Çar', orders: 15 },
  { name: 'Per', orders: 22 },
  { name: 'Cum', orders: 28 },
  { name: 'Cmt', orders: 35 },
  { name: 'Paz', orders: 18 },
]

const recentOrders = [
  { id: '#ORD-2841', customer: 'Ahmet Yılmaz', amount: '₺1,250.00', status: 'completed', date: '2 dk önce' },
  { id: '#ORD-2840', customer: 'Fatma Demir', amount: '₺890.00', status: 'processing', date: '15 dk önce' },
  { id: '#ORD-2839', customer: 'Mehmet Kaya', amount: '₺2,450.00', status: 'pending', date: '42 dk önce' },
  { id: '#ORD-2838', customer: 'Ayşe Çelik', amount: '₺675.00', status: 'completed', date: '1 sa önce' },
  { id: '#ORD-2837', customer: 'Ali Öztürk', amount: '₺1,890.00', status: 'shipped', date: '2 sa önce' },
]

const topProducts = [
  { name: 'Bireysel Deprem Çantası', sold: 156, revenue: '₺46,800' },
  { name: 'Profesyonel 4 Kişilik Set', sold: 89, revenue: '₺71,200' },
  { name: 'Kapsamlı İlk Yardım Çantası', sold: 134, revenue: '₺26,800' },
  { name: 'Acil Durum Kiti', sold: 67, revenue: '₺20,100' },
]

const statusMap: Record<string, { label: string; class: string }> = {
  completed: { label: 'Tamamlandı', class: 'badge--success' },
  processing: { label: 'Hazırlanıyor', class: 'badge--info' },
  pending: { label: 'Beklemede', class: 'badge--warning' },
  shipped: { label: 'Kargoda', class: 'badge--info' },
}

export default function Dashboard() {
  return (
    <>
      <Header title="Dashboard" subtitle="Genel bakış ve istatistikler" />
      <div className="dashboard">
        {/* Stats Cards */}
        <div className="dashboard__stats">
          <StatCard
            title="Toplam Gelir"
            value="₺183,700"
            change="+12.5%"
            trend="up"
            icon={<DollarSign size={20} />}
            color="primary"
          />
          <StatCard
            title="Siparişler"
            value="1,284"
            change="+8.2%"
            trend="up"
            icon={<ShoppingCart size={20} />}
            color="success"
          />
          <StatCard
            title="Müşteriler"
            value="3,427"
            change="+15.3%"
            trend="up"
            icon={<Users size={20} />}
            color="info"
          />
          <StatCard
            title="Ürünler"
            value="86"
            change="-2.1%"
            trend="down"
            icon={<Package size={20} />}
            color="warning"
          />
        </div>

        {/* Charts */}
        <div className="dashboard__charts">
          <div className="card dashboard__chart-card">
            <div className="dashboard__chart-header">
              <h3>Gelir Trendi</h3>
              <span className="badge badge--success">
                <TrendingUp size={12} /> Bu ay +12.5%
              </span>
            </div>
            <div className="dashboard__chart">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#6b7394" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6b7394" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₺${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{ background: '#1e2235', border: '1px solid #2a2f4a', borderRadius: '8px', fontSize: '13px' }}
                    formatter={(value: number) => [`₺${value.toLocaleString()}`, 'Gelir']}
                  />
                  <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card dashboard__chart-card">
            <div className="dashboard__chart-header">
              <h3>Haftalık Siparişler</h3>
              <span className="badge badge--info">Bu hafta 149</span>
            </div>
            <div className="dashboard__chart">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={ordersByDay}>
                  <XAxis dataKey="name" stroke="#6b7394" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6b7394" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#1e2235', border: '1px solid #2a2f4a', borderRadius: '8px', fontSize: '13px' }}
                    formatter={(value: number) => [value, 'Sipariş']}
                  />
                  <Bar dataKey="orders" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Tables */}
        <div className="dashboard__tables">
          <div className="dashboard__table-section">
            <div className="dashboard__section-header">
              <h3>Son Siparişler</h3>
              <button className="btn btn--ghost btn--sm">
                Tümünü Gör <ArrowUpRight size={14} />
              </button>
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
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td><strong>{order.id}</strong></td>
                      <td>{order.customer}</td>
                      <td>{order.amount}</td>
                      <td>
                        <span className={`badge ${statusMap[order.status].class}`}>
                          {statusMap[order.status].label}
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-tertiary)' }}>
                          <Clock size={13} /> {order.date}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="dashboard__table-section">
            <div className="dashboard__section-header">
              <h3>En Çok Satan Ürünler</h3>
              <button className="btn btn--ghost btn--sm">
                Tümünü Gör <ArrowUpRight size={14} />
              </button>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Ürün</th>
                    <th>Satış</th>
                    <th>Gelir</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((product, i) => (
                    <tr key={i}>
                      <td><strong>{product.name}</strong></td>
                      <td>{product.sold} adet</td>
                      <td>{product.revenue}</td>
                      <td>
                        <button className="btn btn--ghost btn--icon" title="Detay">
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function StatCard({ title, value, change, trend, icon, color }: {
  title: string
  value: string
  change: string
  trend: 'up' | 'down'
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className={`stat-card stat-card--${color} animate-fadeIn`}>
      <div className="stat-card__header">
        <span className="stat-card__title">{title}</span>
        <div className="stat-card__icon">{icon}</div>
      </div>
      <div className="stat-card__value">{value}</div>
      <div className={`stat-card__change stat-card__change--${trend}`}>
        {trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        <span>{change} geçen aya göre</span>
      </div>
    </div>
  )
}
