import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  hasError: boolean
  message?: string
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surfaced in the console for debugging; wire to an error tracker in prod.
    console.error('Admin panel crashed:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Beklenmeyen bir hata oluştu</h1>
          <p style={{ color: 'var(--text-tertiary)', maxWidth: 440 }}>
            {this.state.message || 'Sayfa yüklenirken bir sorunla karşılaşıldı.'}
          </p>
          <button className="btn btn--primary" onClick={() => window.location.reload()}>
            Sayfayı Yenile
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
