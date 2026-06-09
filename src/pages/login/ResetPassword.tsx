import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Shield, KeyRound, CheckCircle2, AlertTriangle } from 'lucide-react'
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
            <Shield size={26} />
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
