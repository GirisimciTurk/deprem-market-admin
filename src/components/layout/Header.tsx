import { Search, User } from 'lucide-react'
import NotificationBell from '../NotificationBell'
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
        <NotificationBell />
        <button className="header__avatar" title="Profil">
          <User size={18} />
        </button>
      </div>
    </header>
  )
}
