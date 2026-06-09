import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { logout } from '../../lib/auth'
import { useCurrentUser } from '../../lib/useCurrentUser'
import { canAccess } from '../../lib/roles'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  FileText,
  Handshake,
  MessageSquare,
  Warehouse,
  Percent,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Shield,
} from 'lucide-react'
import './Sidebar.css'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/products', icon: Package, label: 'Ürünler' },
  { path: '/inventory', icon: Warehouse, label: 'Depo & Envanter' },
  { path: '/orders', icon: ShoppingCart, label: 'Siparişler' },
  { path: '/promotions', icon: Percent, label: 'Promosyonlar' },
  { path: '/customers', icon: Users, label: 'Müşteriler' },
  { path: '/blog', icon: FileText, label: 'Blog' },
  { path: '/resellers', icon: Handshake, label: 'Bayilik' },
  { path: '/reviews', icon: MessageSquare, label: 'Yorumlar' },
  { path: '/settings', icon: Settings, label: 'Ayarlar' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const location = useLocation()
  const { role } = useCurrentUser()
  const visibleItems = navItems.filter((item) => canAccess(role, item.path))

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__header">
        <div className="sidebar__logo">
          <div className="sidebar__logo-icon">
            <Shield size={22} />
          </div>
          {!collapsed && (
            <div className="sidebar__logo-text">
              <span className="sidebar__logo-title">Deprem Market</span>
              <span className="sidebar__logo-subtitle">Admin Panel</span>
            </div>
          )}
        </div>
        <button
          className="sidebar__toggle"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Genişlet' : 'Daralt'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="sidebar__nav">
        {visibleItems.map((item) => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path)

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={20} />
              {!collapsed && <span>{item.label}</span>}
              {isActive && <div className="sidebar__link-indicator" />}
            </NavLink>
          )
        })}
      </nav>

      <div className="sidebar__footer">
        <button
          className="sidebar__link sidebar__logout"
          title="Çıkış Yap"
          onClick={() => setConfirmLogout(true)}
        >
          <LogOut size={20} />
          {!collapsed && <span>Çıkış Yap</span>}
        </button>
      </div>

      {confirmLogout && (
        <ConfirmDialog
          title="Çıkış Yap"
          message="Oturumu kapatmak istediğinize emin misiniz?"
          confirmLabel="Çıkış Yap"
          danger
          onConfirm={() => logout()}
          onCancel={() => setConfirmLogout(false)}
        />
      )}
    </aside>
  )
}
