import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { requestPasswordReset } from '../../lib/auth'
import { Spinner } from '../../components/ui/Spinner'
import './Login.css'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError('Lütfen e-posta adresinizi girin.')
      return
    }
    setLoading(true)
    try {
      await requestPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İstek gönderilemedi.')
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
            <h1 className="login__title">Şifre Sıfırlama</h1>
            <p className="login__subtitle">Yönetim Paneli</p>
          </div>
        </div>

        {sent ? (
          <>
            <div
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', padding: '12px 0 20px' }}
            >
              <CheckCircle2 size={40} style={{ color: 'var(--accent-success)' }} />
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Eğer bu e-posta bir hesaba bağlıysa, şifre sıfırlama bağlantısı gönderildi.
                Lütfen gelen kutunuzu kontrol edin.
              </p>
            </div>
            <Link to="/login" className="btn btn--secondary login__submit" style={{ textDecoration: 'none' }}>
              <ArrowLeft size={16} /> Girişe Dön
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginBottom: 18 }}>
              Hesabınıza bağlı e-posta adresini girin; size bir şifre sıfırlama bağlantısı gönderelim.
            </p>

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

            <button className="btn btn--primary login__submit" type="submit" disabled={loading}>
              {loading ? <Spinner size={16} /> : <Mail size={16} />}
              {loading ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'}
            </button>

            <Link
              to="/login"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, fontSize: '0.82rem', color: 'var(--text-tertiary)' }}
            >
              <ArrowLeft size={14} /> Girişe dön
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
