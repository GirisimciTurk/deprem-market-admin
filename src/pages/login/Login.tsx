import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { login, isAuthenticated } from '../../lib/auth'
import { Spinner } from '../../components/ui/Spinner'
import './Login.css'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // If already logged in, skip straight to the dashboard.
  if (isAuthenticated()) {
    navigate('/', { replace: true })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Lütfen e-posta ve şifrenizi girin.')
      return
    }
    setLoading(true)
    try {
      await login(email.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={handleSubmit}>
        <div className="login__brand">
          {/* depremTek resmi marka logosu (storefront ile ortak) */}
          <img
            src="/images/depremtek-logo.webp"
            alt="depremTek"
            className="login__brand-logo"
          />
          <div>
            <h1 className="login__title">Yönetim Paneli</h1>
            <p className="login__subtitle">Deprem Market</p>
          </div>
        </div>

        {error && <div className="login__error">{error}</div>}

        <div className="field">
          <label className="field__label" htmlFor="email">E-posta</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@deprem-market.com"
            disabled={loading}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="password">Şifre</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={loading}
          />
        </div>

        <button className="btn btn--primary login__submit" type="submit" disabled={loading}>
          {loading ? <Spinner size={16} /> : <LogIn size={16} />}
          {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link
            to="/forgot-password"
            style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}
          >
            Şifremi unuttum
          </Link>
        </div>
      </form>
    </div>
  )
}
