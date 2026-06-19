import { Plus, Trash2, Save } from 'lucide-react'
import type { Announcement, CookieConsent, NavLink, StoreDetails } from './settings-types'

/** Vitrin ayar sekmeleri — her biri kendi state dilimini value/onChange ile alır,
 *  kaydetmeyi onSave callback'ine bırakır. */

export function StoreTab({
  value,
  onChange,
  onSave,
  saving,
}: {
  value: StoreDetails
  onChange: (v: StoreDetails) => void
  onSave: () => void
  saving: boolean
}) {
  return (
    <div>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '4px' }}>Mağaza Genel Bilgileri</h3>
      <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginBottom: '20px' }}>
        Müşteri desteği, iletişim ve fatura bilgilerini buradan yapılandırın.
      </p>

      <div className="field">
        <label className="field__label">Mağaza Adı</label>
        <input
          type="text"
          value={value.storeName}
          onChange={(e) => onChange({ ...value, storeName: e.target.value })}
        />
      </div>

      <div className="settings-form-row settings-form-row-2col">
        <div className="field">
          <label className="field__label">Destek E-posta Adresi</label>
          <input
            type="email"
            value={value.email}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="field__label">Telefon Numarası</label>
          <input
            type="text"
            value={value.phone}
            onChange={(e) => onChange({ ...value, phone: e.target.value })}
          />
        </div>
      </div>

      <div className="field">
        <label className="field__label">Adres / Merkez</label>
        <textarea
          rows={3}
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
        <button className="btn btn--primary" disabled={saving} onClick={onSave}>
          <Save size={16} /> {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
        </button>
      </div>
    </div>
  )
}

export function NavTab({
  value,
  onChange,
  onSave,
  saving,
}: {
  value: NavLink[]
  onChange: (v: NavLink[]) => void
  onSave: () => void
  saving: boolean
}) {
  const addNavLink = () => onChange([...value, { label: 'Yeni Sayfa', url: '/' }])
  const updateNavLink = (index: number, field: keyof NavLink, val: string) => {
    const updated = [...value]
    updated[index][field] = val
    onChange(updated)
  }
  const deleteNavLink = (index: number) => onChange(value.filter((_, i) => i !== index))

  return (
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
        {value.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', border: '1px dashed var(--border-primary)', borderRadius: 'var(--radius-md)', color: 'var(--text-tertiary)' }}>
            Henüz menü bağlantısı eklenmemiş.
          </div>
        ) : (
          value.map((link, index) => (
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
        <button className="btn btn--primary" disabled={saving} onClick={onSave}>
          <Save size={16} /> {saving ? 'Kaydediliyor...' : 'Menüyü Kaydet'}
        </button>
      </div>
    </div>
  )
}

export function AnnouncementTab({
  value,
  onChange,
  onSave,
  saving,
}: {
  value: Announcement
  onChange: (v: Announcement) => void
  onSave: () => void
  saving: boolean
}) {
  return (
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
            checked={value.enabled}
            onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
          />
          <span className="switch-slider"></span>
        </span>
      </label>

      <div className="field">
        <label className="field__label">Duyuru Mesajı</label>
        <input
          type="text"
          placeholder="Duyuru / kampanya mesajı yazın..."
          value={value.message}
          onChange={(e) => onChange({ ...value, message: e.target.value })}
          disabled={!value.enabled}
        />
      </div>

      <div className="settings-form-row settings-form-row-2col">
        <div className="field">
          <label className="field__label">Arka Plan Rengi</label>
          <div className="color-picker-wrapper">
            <input
              type="color"
              className="color-picker-input"
              value={value.backgroundColor}
              onChange={(e) => onChange({ ...value, backgroundColor: e.target.value })}
              disabled={!value.enabled}
            />
            <input
              type="text"
              value={value.backgroundColor}
              onChange={(e) => onChange({ ...value, backgroundColor: e.target.value })}
              disabled={!value.enabled}
            />
          </div>
        </div>
        <div className="field">
          <label className="field__label">Yazı Rengi</label>
          <div className="color-picker-wrapper">
            <input
              type="color"
              className="color-picker-input"
              value={value.textColor}
              onChange={(e) => onChange({ ...value, textColor: e.target.value })}
              disabled={!value.enabled}
            />
            <input
              type="text"
              value={value.textColor}
              onChange={(e) => onChange({ ...value, textColor: e.target.value })}
              disabled={!value.enabled}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
        <button className="btn btn--primary" disabled={saving} onClick={onSave}>
          <Save size={16} /> {saving ? 'Kaydediliyor...' : 'Duyuru Ayarlarını Kaydet'}
        </button>
      </div>
    </div>
  )
}

export function CookieTab({
  value,
  onChange,
  onSave,
  saving,
}: {
  value: CookieConsent
  onChange: (v: CookieConsent) => void
  onSave: () => void
  saving: boolean
}) {
  return (
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
            checked={value.enabled}
            onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
          />
          <span className="switch-slider"></span>
        </span>
      </label>

      <div className="field">
        <label className="field__label">Uarı Başlığı</label>
        <input
          type="text"
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          disabled={!value.enabled}
        />
      </div>

      <div className="field">
        <label className="field__label">Açıklama Metni</label>
        <textarea
          rows={3}
          value={value.message}
          onChange={(e) => onChange({ ...value, message: e.target.value })}
          disabled={!value.enabled}
        />
      </div>

      <div className="settings-form-row settings-form-row-2col">
        <div className="field">
          <label className="field__label">Kabul Et Buton Metni</label>
          <input
            type="text"
            value={value.acceptLabel}
            onChange={(e) => onChange({ ...value, acceptLabel: e.target.value })}
            disabled={!value.enabled}
          />
        </div>
        <div className="field">
          <label className="field__label">Reddet Buton Metni</label>
          <input
            type="text"
            value={value.declineLabel}
            onChange={(e) => onChange({ ...value, declineLabel: e.target.value })}
            disabled={!value.enabled}
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
        <button className="btn btn--primary" disabled={saving} onClick={onSave}>
          <Save size={16} /> {saving ? 'Kaydediliyor...' : 'Çerez Ayarlarını Kaydet'}
        </button>
      </div>
    </div>
  )
}
