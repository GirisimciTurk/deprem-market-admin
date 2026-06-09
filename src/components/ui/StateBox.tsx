import type { ReactNode } from 'react'
import { Inbox, AlertTriangle, RefreshCw } from 'lucide-react'
import './ui.css'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="card state-box">
      <div className="state-box__icon">{icon ?? <Inbox size={26} />}</div>
      <h3 className="state-box__title">{title}</h3>
      {description && <p className="state-box__desc">{description}</p>}
      {action}
    </div>
  )
}

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="card state-box">
      <div className="state-box__icon" style={{ color: 'var(--accent-danger)', background: 'var(--accent-danger-light)' }}>
        <AlertTriangle size={26} />
      </div>
      <h3 className="state-box__title">Bir hata oluştu</h3>
      <p className="state-box__desc">{message || 'Veriler yüklenemedi. Lütfen tekrar deneyin.'}</p>
      {onRetry && (
        <button className="btn btn--secondary" onClick={onRetry}>
          <RefreshCw size={15} /> Tekrar Dene
        </button>
      )}
    </div>
  )
}
