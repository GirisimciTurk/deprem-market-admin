import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Plus,
  Trash2,
  Save,
  Cookie,
  Megaphone,
  Menu,
  Store,
  ArrowRight,
  RefreshCw
} from 'lucide-react'
import Header from '../../components/layout/Header'
import { useToast } from '../../components/ui/toast-context'
import { api } from '../../lib/api'
import { LoadingState } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/StateBox'
import './Settings.css'

interface NavLink {
  label: string
  url: string
}

interface CookieConsent {
  enabled: boolean
  title: string
  message: string
  acceptLabel: string
  declineLabel: string
}

interface Announcement {
  enabled: boolean
  message: string
  backgroundColor: string
  textColor: string
}

interface StoreDetails {
  storeName: string
  email: string
  phone: string
  address: string
}

interface SettingsResponse {
  settings: Array<{
    id: string
    key: string
    value: any
  }>
}

export default function SettingsPage() {
  const { notify } = useToast()
  const [activeTab, setActiveTab] = useState<'store' | 'nav' | 'announcement' | 'cookie'>('store')
  const [saving, setSaving] = useState(false)

  // Local Form States
  const [storeDetails, setStoreDetails] = useState<StoreDetails>({
    storeName: 'Deprem Market',
    email: 'destek@depremmarket.com',
    phone: '+90 850 000 0000',
    address: 'İstanbul, Türkiye'
  })

  const [navLinks, setNavLinks] = useState<NavLink[]>([
    { label: 'Ana Sayfa', url: '/' },
    { label: 'Ürünler', url: '/products' }
  ])

  const [announcement, setAnnouncement] = useState<Announcement>({
    enabled: true,
    message: '500 TL ve Üzeri Alışverişlerinizde Kargo Bedava!',
    backgroundColor: '#6366f1',
    textColor: '#ffffff'
  })

  const [cookieConsent, setCookieConsent] = useState<CookieConsent>({
    enabled: true,
    title: 'Çerez Politikası',
    message: 'Size en iyi deneyimi sunabilmek için sitemizde çerezler kullanmaktayız.',
    acceptLabel: 'Kabul Et',
    declineLabel: 'Reddet'
  })

  // Fetch Settings from Medusa
  const { data, isLoading, isError, error, refetch } = useQuery<SettingsResponse>({
    queryKey: ['storefront-settings'],
    queryFn: () => api.get<SettingsResponse>('/admin/storefront-settings')
  })

  // Populating states when data is fetched
  useEffect(() => {
    if (data?.settings && Array.isArray(data.settings)) {
      data.settings.forEach((setting) => {
        if (setting.key === 'store-details' && setting.value) {
          setStoreDetails((prev) => ({ ...prev, ...setting.value }))
        } else if (setting.key === 'nav-links' && Array.isArray(setting.value)) {
          setNavLinks(setting.value)
        } else if (setting.key === 'announcement' && setting.value) {
          setAnnouncement((prev) => ({ ...prev, ...setting.value }))
        } else if (setting.key === 'cookie-consent' && setting.value) {
          setCookieConsent((prev) => ({ ...prev, ...setting.value }))
        }
      })
    }
  }, [data])

  // Save Settings handler
  const handleSave = async (key: string, value: any) => {
    setSaving(true)
    try {
      await api.post('/admin/storefront-settings', { key, value })
      notify('Ayarlar başarıyla kaydedildi.', 'success')
      refetch()
    } catch (err: any) {
      notify(err.message || 'Kaydedilirken bir hata oluştu.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Nav link actions
  const addNavLink = () => {
    setNavLinks([...navLinks, { label: 'Yeni Sayfa', url: '/' }])
  }

  const updateNavLink = (index: number, field: keyof NavLink, val: string) => {
    const updated = [...navLinks]
    updated[index][field] = val
    setNavLinks(updated)
  }

  const deleteNavLink = (index: number) => {
    setNavLinks(navLinks.filter((_, i) => i !== index))
  }

  if (isLoading) {
    return <LoadingState label="Ayarlar yükleniyor..." />
  }

  if (isError) {
    return <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
  }

  return (
    <>
      <Header
        title="Ayarlar"
        subtitle="Mağaza genel bilgilerini ve vitrin bileşenlerini düzenleyin"
        actions={
          <button className="btn btn--secondary btn--sm" onClick={() => refetch()}>
            <RefreshCw size={14} /> Yenile
          </button>
        }
      />
      
      <div style={{ padding: '24px' }}>
        <div className="settings-grid">
          {/* Settings Form Card (Left) */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="settings-tabs-header">
              <button
                className={`settings-tab-btn ${activeTab === 'store' ? 'settings-tab-btn--active' : ''}`}
                onClick={() => setActiveTab('store')}
              >
                <Store size={16} /> Mağaza Bilgileri
              </button>
              <button
                className={`settings-tab-btn ${activeTab === 'nav' ? 'settings-tab-btn--active' : ''}`}
                onClick={() => setActiveTab('nav')}
              >
                <Menu size={16} /> Navigasyon
              </button>
              <button
                className={`settings-tab-btn ${activeTab === 'announcement' ? 'settings-tab-btn--active' : ''}`}
                onClick={() => setActiveTab('announcement')}
              >
                <Megaphone size={16} /> Duyuru Barı
              </button>
              <button
                className={`settings-tab-btn ${activeTab === 'cookie' ? 'settings-tab-btn--active' : ''}`}
                onClick={() => setActiveTab('cookie')}
              >
                <Cookie size={16} /> Çerez Politikası
              </button>
            </div>

            <div className="settings-tab-content">
              {/* Tab 1: Store Details */}
              {activeTab === 'store' && (
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '4px' }}>Mağaza Genel Bilgileri</h3>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginBottom: '20px' }}>
                    Müşteri desteği, iletişim ve fatura bilgilerini buradan yapılandırın.
                  </p>

                  <div className="field">
                    <label className="field__label">Mağaza Adı</label>
                    <input
                      type="text"
                      value={storeDetails.storeName}
                      onChange={(e) => setStoreDetails({ ...storeDetails, storeName: e.target.value })}
                    />
                  </div>

                  <div className="settings-form-row settings-form-row-2col">
                    <div className="field">
                      <label className="field__label">Destek E-posta Adresi</label>
                      <input
                        type="email"
                        value={storeDetails.email}
                        onChange={(e) => setStoreDetails({ ...storeDetails, email: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label className="field__label">Telefon Numarası</label>
                      <input
                        type="text"
                        value={storeDetails.phone}
                        onChange={(e) => setStoreDetails({ ...storeDetails, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label className="field__label">Adres / Merkez</label>
                    <textarea
                      rows={3}
                      value={storeDetails.address}
                      onChange={(e) => setStoreDetails({ ...storeDetails, address: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                    <button
                      className="btn btn--primary"
                      disabled={saving}
                      onClick={() => handleSave('store-details', storeDetails)}
                    >
                      <Save size={16} /> {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 2: Navigation Links */}
              {activeTab === 'nav' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '4px' }}>Vitrin Menü Bağlantıları</h3>
                      <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                        Üst menü çubuğunda gösterilecek sayfalar ve dış bağlantılar.
                      </p>
                    </div>
                    <button className="btn btn--secondary btn--sm" onClick={addNavLink}>
                      <Plus size={14} /> Yeni Ekle
                    </button>
                  </div>

                  <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
                    {navLinks.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '32px', border: '1px dashed var(--border-primary)', borderRadius: 'var(--radius-md)', color: 'var(--text-tertiary)' }}>
                        Henüz menü bağlantısı eklenmemiş.
                      </div>
                    ) : (
                      navLinks.map((link, index) => (
                        <div key={index} className="settings-link-item animate-fadeIn">
                          <div className="settings-link-inputs">
                            <input
                              type="text"
                              placeholder="Menü Başlığı (örn: Hakkımızda)"
                              value={link.label}
                              onChange={(e) => updateNavLink(index, 'label', e.target.value)}
                            />
                            <input
                              type="text"
                              placeholder="Yönlendirme Linki (örn: /hakkimizda)"
                              value={link.url}
                              onChange={(e) => updateNavLink(index, 'url', e.target.value)}
                            />
                          </div>
                          <button
                            className="btn btn--danger btn--icon btn--sm"
                            title="Bağlantıyı Sil"
                            onClick={() => deleteNavLink(index)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-primary)' }}>
                    <button
                      className="btn btn--primary"
                      disabled={saving}
                      onClick={() => handleSave('nav-links', navLinks)}
                    >
                      <Save size={16} /> {saving ? 'Kaydediliyor...' : 'Menüyü Kaydet'}
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 3: Announcement Bar */}
              {activeTab === 'announcement' && (
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '4px' }}>Duyuru Metni ve Kampanya Barı</h3>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginBottom: '20px' }}>
                    Mağazanın en üstünde gösterilecek duyuruyu yapılandırın.
                  </p>

                  <label className="switch-label">
                    <div>
                      <span style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem' }}>Duyuru Barı Aktif</span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>Vitrin sitesinde duyuruyu göster/gizle.</span>
                    </div>
                    <span className="switch-control">
                      <input
                        type="checkbox"
                        checked={announcement.enabled}
                        onChange={(e) => setAnnouncement({ ...announcement, enabled: e.target.checked })}
                      />
                      <span className="switch-slider"></span>
                    </span>
                  </label>

                  <div className="field">
                    <label className="field__label">Duyuru Mesajı</label>
                    <input
                      type="text"
                      placeholder="Duyuru / kampanya mesajı yazın..."
                      value={announcement.message}
                      onChange={(e) => setAnnouncement({ ...announcement, message: e.target.value })}
                      disabled={!announcement.enabled}
                    />
                  </div>

                  <div className="settings-form-row settings-form-row-2col">
                    <div className="field">
                      <label className="field__label">Arka Plan Rengi</label>
                      <div className="color-picker-wrapper">
                        <input
                          type="color"
                          className="color-picker-input"
                          value={announcement.backgroundColor}
                          onChange={(e) => setAnnouncement({ ...announcement, backgroundColor: e.target.value })}
                          disabled={!announcement.enabled}
                        />
                        <input
                          type="text"
                          value={announcement.backgroundColor}
                          onChange={(e) => setAnnouncement({ ...announcement, backgroundColor: e.target.value })}
                          disabled={!announcement.enabled}
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label className="field__label">Yazı Rengi</label>
                      <div className="color-picker-wrapper">
                        <input
                          type="color"
                          className="color-picker-input"
                          value={announcement.textColor}
                          onChange={(e) => setAnnouncement({ ...announcement, textColor: e.target.value })}
                          disabled={!announcement.enabled}
                        />
                        <input
                          type="text"
                          value={announcement.textColor}
                          onChange={(e) => setAnnouncement({ ...announcement, textColor: e.target.value })}
                          disabled={!announcement.enabled}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                    <button
                      className="btn btn--primary"
                      disabled={saving}
                      onClick={() => handleSave('announcement', announcement)}
                    >
                      <Save size={16} /> {saving ? 'Kaydediliyor...' : 'Duyuru Ayarlarını Kaydet'}
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 4: Cookie Consent */}
              {activeTab === 'cookie' && (
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '4px' }}>Çerez İzin Uyarısı</h3>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginBottom: '20px' }}>
                    KVKK / GDPR gereklilikleri için ziyaretçilere gösterilen çerez onay barını yönetin.
                  </p>

                  <label className="switch-label">
                    <div>
                      <span style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem' }}>Çerez Politikası Uyarısı Aktif</span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>Ziyaretçilere onay kutusunu göster.</span>
                    </div>
                    <span className="switch-control">
                      <input
                        type="checkbox"
                        checked={cookieConsent.enabled}
                        onChange={(e) => setCookieConsent({ ...cookieConsent, enabled: e.target.checked })}
                      />
                      <span className="switch-slider"></span>
                    </span>
                  </label>

                  <div className="field">
                    <label className="field__label">Uarı Başlığı</label>
                    <input
                      type="text"
                      value={cookieConsent.title}
                      onChange={(e) => setCookieConsent({ ...cookieConsent, title: e.target.value })}
                      disabled={!cookieConsent.enabled}
                    />
                  </div>

                  <div className="field">
                    <label className="field__label">Açıklama Metni</label>
                    <textarea
                      rows={3}
                      value={cookieConsent.message}
                      onChange={(e) => setCookieConsent({ ...cookieConsent, message: e.target.value })}
                      disabled={!cookieConsent.enabled}
                    />
                  </div>

                  <div className="settings-form-row settings-form-row-2col">
                    <div className="field">
                      <label className="field__label">Kabul Et Buton Metni</label>
                      <input
                        type="text"
                        value={cookieConsent.acceptLabel}
                        onChange={(e) => setCookieConsent({ ...cookieConsent, acceptLabel: e.target.value })}
                        disabled={!cookieConsent.enabled}
                      />
                    </div>
                    <div className="field">
                      <label className="field__label">Reddet Buton Metni</label>
                      <input
                        type="text"
                        value={cookieConsent.declineLabel}
                        onChange={(e) => setCookieConsent({ ...cookieConsent, declineLabel: e.target.value })}
                        disabled={!cookieConsent.enabled}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                    <button
                      className="btn btn--primary"
                      disabled={saving}
                      onClick={() => handleSave('cookie-consent', cookieConsent)}
                    >
                      <Save size={16} /> {saving ? 'Kaydediliyor...' : 'Çerez Ayarlarını Kaydet'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live Mockup Preview Panel (Right) */}
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
        </div>
      </div>
    </>
  )
}
