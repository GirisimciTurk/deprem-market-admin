import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { ToastContext, type ToastType } from './toast-context'
import './ui.css'

interface ToastItem {
  id: number
  type: ToastType
  message: string
}

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const notify = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId++
    setToasts((t) => [...t, { id, type, message }])
    setTimeout(() => {
      setToasts((t) => t.filter((item) => item.id !== id))
    }, 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            {t.type === 'success' && <CheckCircle2 size={16} style={{ color: 'var(--accent-success)' }} />}
            {t.type === 'error' && <AlertCircle size={16} style={{ color: 'var(--accent-danger)' }} />}
            {t.type === 'info' && <Info size={16} style={{ color: 'var(--accent-info)' }} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
