import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Cookie, Megaphone, Menu, Store, RefreshCw } from 'lucide-react'
import Header from '../../components/layout/Header'
import { useToast } from '../../components/ui/toast-context'
import { api } from '../../lib/api'
import { LoadingState } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/StateBox'
import type { Announcement, CookieConsent, NavLink, StoreDetails, SettingsResponse } from './settings-types'
import { StoreTab, NavTab, AnnouncementTab, CookieTab } from './settings-tabs'
import SettingsPreview from './settings-preview'
import './Settings.css'

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
    backgroundColor: '#F08C1A',
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
              {activeTab === 'store' && (
                <StoreTab
                  value={storeDetails}
                  onChange={setStoreDetails}
                  onSave={() => handleSave('store-details', storeDetails)}
                  saving={saving}
                />
              )}
              {activeTab === 'nav' && (
                <NavTab
                  value={navLinks}
                  onChange={setNavLinks}
                  onSave={() => handleSave('nav-links', navLinks)}
                  saving={saving}
                />
              )}
              {activeTab === 'announcement' && (
                <AnnouncementTab
                  value={announcement}
                  onChange={setAnnouncement}
                  onSave={() => handleSave('announcement', announcement)}
                  saving={saving}
                />
              )}
              {activeTab === 'cookie' && (
                <CookieTab
                  value={cookieConsent}
                  onChange={setCookieConsent}
                  onSave={() => handleSave('cookie-consent', cookieConsent)}
                  saving={saving}
                />
              )}
            </div>
          </div>

          {/* Live Mockup Preview Panel (Right) */}
          <SettingsPreview
            announcement={announcement}
            navLinks={navLinks}
            storeDetails={storeDetails}
            cookieConsent={cookieConsent}
          />
        </div>
      </div>
    </>
  )
}
