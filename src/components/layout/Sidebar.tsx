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
  MessageCircleQuestion,
  Percent,
  Undo2,
  Store,
  Calculator,
  ClipboardCheck,
  Receipt,
  Star,
  FileSignature,
  Settings,
  Award,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Shield,
} from 'lucide-react'
import './Sidebar.css'

// Admin = KONTROL MERKEZİ: gözetim + moderasyon + yapılandırma + ödeme. Satış operasyonu
// (ürün ekle/düzenle, stok, kargolama) satıcı panelinde yürür. Bu yüzden Depo & Envanter
// ve Stok Geçmişi operasyonel nav'ları kaldırıldı; Ürünler/Siparişler/İadeler "Gözetim".
const navGroups: { title: string | null; items: { path: string; icon: typeof Package; label: string }[] }[] = [
  {
    title: null,
    items: [{ path: '/', icon: LayoutDashboard, label: 'Genel Bakış' }],
  },
  {
    title: 'Pazaryeri',
    items: [
      { path: '/sellers', icon: Store, label: 'Satıcılar' },
      { path: '/seller-scorecards', icon: Award, label: 'Performans Karneleri' },
      { path: '/resellers', icon: Handshake, label: 'Bayilik Başvuruları' },
      { path: '/seller-contracts', icon: FileSignature, label: 'Sözleşmeler' },
      { path: '/commission-rules', icon: Calculator, label: 'Komisyon Oranları' },
    ],
  },
  {
    title: 'Moderasyon',
    items: [
      { path: '/product-approvals', icon: ClipboardCheck, label: 'Ürün Onayları' },
      { path: '/reviews', icon: MessageSquare, label: 'Yorumlar' },
      { path: '/product-questions', icon: MessageCircleQuestion, label: 'Sorular' },
      { path: '/seller-reviews', icon: Star, label: 'Satıcı Değerlendirmeleri' },
    ],
  },
  {
    title: 'Gözetim',
    items: [
      { path: '/products', icon: Package, label: 'Ürünler' },
      { path: '/orders', icon: ShoppingCart, label: 'Siparişler' },
      { path: '/returns', icon: Undo2, label: 'İadeler' },
      { path: '/invoices', icon: Receipt, label: 'Faturalar' },
    ],
  },
  {
    title: 'Müşteri & İçerik',
    items: [
      { path: '/customers', icon: Users, label: 'Müşteriler' },
      { path: '/promotions', icon: Percent, label: 'Promosyonlar' },
      { path: '/blog', icon: FileText, label: 'Blog' },
    ],
  },
  {
    title: 'Sistem',
    items: [{ path: '/settings', icon: Settings, label: 'Ayarlar' }],
  },
]

const SIDEBAR_KEY = 'dm_sidebar_collapsed'

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1')
  const [confirmLogout, setConfirmLogout] = useState(false)

  const toggleCollapsed = () =>
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0')
      return next
    })
  const location = useLocation()
  const { role } = useCurrentUser()
  // Her grubu role göre filtrele; tamamen boşalan grubu (ör. staff) gizle.
  const visibleGroups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((item) => canAccess(role, item.path)) }))
    .filter((g) => g.items.length > 0)

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
              <span className="sidebar__logo-subtitle">Kontrol Merkezi</span>
            </div>
          )}
        </div>
        <button
          className="sidebar__toggle"
          onClick={toggleCollapsed}
          title={collapsed ? 'Genişlet' : 'Daralt'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="sidebar__nav">
        {visibleGroups.map((group, gi) => (
          <div key={group.title ?? `g${gi}`} className="sidebar__group">
            {group.title && !collapsed && (
              <div className="sidebar__group-title">{group.title}</div>
            )}
            {group.items.map((item) => {
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
          </div>
        ))}
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
