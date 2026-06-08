import { Search, Bell, User } from 'lucide-react'
import './Header.css'

interface HeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export default function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <header className="header">
      <div className="header__left">
        <div>
          <h1 className="header__title">{title}</h1>
          {subtitle && <p className="header__subtitle">{subtitle}</p>}
        </div>
      </div>
      <div className="header__right">
        {actions}
        <div className="header__search">
          <Search size={16} />
          <input type="text" placeholder="Ara..." className="header__search-input" />
        </div>
        <button className="header__icon-btn" title="Bildirimler">
          <Bell size={18} />
          <span className="header__notification-dot" />
        </button>
        <button className="header__avatar" title="Profil">
          <User size={18} />
        </button>
      </div>
    </header>
  )
}
