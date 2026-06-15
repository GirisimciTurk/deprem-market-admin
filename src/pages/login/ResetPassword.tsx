import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound, CheckCircle2, AlertTriangle } from 'lucide-react'
import { resetPassword } from '../../lib/auth'
import { Spinner } from '../../components/ui/Spinner'
import './Login.css'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Şifre en az 8 karakter olmalıdır.')
      return
    }
    if (password !== confirm) {
      setError('Şifreler eşleşmiyor.')
      return
    }
    setLoading(true)
    try {
      await resetPassword(token, password)
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Şifre güncellenemedi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login">
      <div className="login__card">
        <div className="login__brand">
          <div className="login__brand-icon">
            <svg width="26" height="26" viewBox="0 0 52 48" fill="none" aria-hidden="true">
              <path fillRule="evenodd" clipRule="evenodd" d="M17 17a11 11 0 1 0 0 22 11 11 0 0 0 0-22Zm0 6.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z" fill="#fff" />
              <rect x="24" y="5" width="6.5" height="34" rx="2" fill="#fff" />
              <rect x="31" y="8" width="15" height="6.5" rx="1.2" fill="#fff" fillOpacity="0.85" />
              <rect x="35" y="8" width="6.5" height="31" rx="1.2" fill="#fff" fillOpacity="0.85" />
            </svg>
          </div>
          <div>
            <h1 className="login__title">Yeni Şifre Belirle</h1>
            <p className="login__subtitle">Yönetim Paneli</p>
          </div>
        </div>

        {!token ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', padding: '12px 0' }}>
            <AlertTriangle size={40} style={{ color: 'var(--accent-warning)' }} />
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Geçersiz veya eksik sıfırlama bağlantısı. Lütfen yeni bir bağlantı isteyin.
            </p>
            <Link to="/forgot-password" className="btn btn--secondary login__submit" style={{ textDecoration: 'none' }}>
              Yeni Bağlantı İste
            </Link>
          </div>
        ) : done ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', padding: '12px 0' }}>
            <CheckCircle2 size={40} style={{ color: 'var(--accent-success)' }} />
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Şifreniz güncellendi. Giriş sayfasına yönlendiriliyorsunuz...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div className="login__error">{error}</div>}

            <div className="field">
              <label className="field__label" htmlFor="password">Yeni Şifre</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="En az 8 karakter"
                disabled={loading}
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="confirm">Yeni Şifre (Tekrar)</label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <button className="btn btn--primary login__submit" type="submit" disabled={loading}>
              {loading ? <Spinner size={16} /> : <KeyRound size={16} />}
              {loading ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
