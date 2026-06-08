import { Settings as SettingsIcon } from 'lucide-react'
import Header from '../../components/layout/Header'

export default function SettingsPage() {
  return (
    <>
      <Header title="Ayarlar" subtitle="Mağaza ve storefront ayarlarını yapılandır" />
      <div style={{ padding: '24px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: '16px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SettingsIcon size={28} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Genel Ayarlar</h3>
          <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 400 }}>
            Mağaza bilgileri, banner yönetimi, kampanya ayarları, SEO konfigürasyonu ve daha fazlası.
          </p>
        </div>
      </div>
    </>
  )
}
