import { ArrowRight } from 'lucide-react'
import type { Announcement, CookieConsent, NavLink, StoreDetails } from './settings-types'

/** Sağ sütun: ayarların vitrin üzerindeki canlı önizlemesi (salt-sunum). */
export default function SettingsPreview({
  announcement,
  navLinks,
  storeDetails,
  cookieConsent,
}: {
  announcement: Announcement
  navLinks: NavLink[]
  storeDetails: StoreDetails
  cookieConsent: CookieConsent
}) {
  return (
    <div className="preview-panel">
      <div className="preview-header">
        <span className="preview-title">📱 Vitrin Canlı Önizleme</span>
        <div className="preview-dots">
          <span className="preview-dot preview-dot--red"></span>
          <span className="preview-dot preview-dot--yellow"></span>
          <span className="preview-dot preview-dot--green"></span>
        </div>
      </div>

      <div className="preview-body">
        <div>
          {/* Announcement Bar Preview */}
          {announcement.enabled ? (
            <div
              className="preview-announcement animate-fadeIn"
              style={{ backgroundColor: announcement.backgroundColor, color: announcement.textColor }}
            >
              {announcement.message || 'Kampanya / Duyuru bulunmuyor'}
            </div>
          ) : (
            <div
              style={{
                height: '28px',
                background: 'var(--bg-secondary)',
                border: '1px dashed var(--border-primary)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.65rem',
                color: 'var(--text-tertiary)',
                marginBottom: '8px'
              }}
            >
              Duyuru Barı Devre Dışı
            </div>
          )}

          {/* Navbar Preview */}
          <div className="preview-navbar" style={{ marginTop: '8px' }}>
            <span className="preview-logo">{storeDetails.storeName.toUpperCase()}</span>
            <div className="preview-menu">
              {navLinks.map((link, index) => (
                <span key={index} className="preview-menu-item">
                  {link.label}
                </span>
              ))}
            </div>
          </div>

          {/* Hero Section Preview */}
          <div className="preview-hero">
            <div className="preview-hero-title">Acil Durum ve Deprem Setleri</div>
            <div className="preview-hero-desc">Hayat kurtaran ekipmanlar, profesyonel hazırlık kitleri.</div>
            <span className="preview-hero-btn">
              Keşfet <ArrowRight size={10} style={{ display: 'inline', marginLeft: 2 }} />
            </span>
          </div>
        </div>

        {/* Cookie Consent Preview */}
        {cookieConsent.enabled ? (
          <div className="preview-cookie-box animate-fadeIn">
            <div className="preview-cookie-title">🍪 {cookieConsent.title}</div>
            <div className="preview-cookie-desc">{cookieConsent.message}</div>
            <div className="preview-cookie-actions">
              <button className="preview-cookie-btn preview-cookie-btn--decline">
                {cookieConsent.declineLabel}
              </button>
              <button className="preview-cookie-btn preview-cookie-btn--accept">
                {cookieConsent.acceptLabel}
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              height: '60px',
              background: 'var(--bg-secondary)',
              border: '1px dashed var(--border-primary)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.72rem',
              color: 'var(--text-tertiary)',
              marginTop: '20px'
            }}
          >
            Çerez Bildirimi Devre Dışı
          </div>
        )}
      </div>
    </div>
  )
}
