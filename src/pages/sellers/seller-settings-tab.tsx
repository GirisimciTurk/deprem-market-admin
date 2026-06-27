import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Copy } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import { useToast } from '../../components/ui/toast-context'
import { api } from '../../lib/api'
import type { Seller, SellerStatus, CarrierCode } from './seller-detail-types'
import { Section, Grid, Field } from './seller-detail-ui'

const CARRIERS: { code: CarrierCode; label: string }[] = [
  { code: 'yurtici', label: 'Yurtiçi Kargo' },
  { code: 'mng', label: 'MNG Kargo' },
  { code: 'ptt', label: 'PTT Kargo' },
]

// ŞİMDİLİK KİLİT — kargo firması seçimi kapalı. Herkes platformun anlaşmalı
// kargosuyla (Yurtiçi) gönderir. Seçimi tekrar açmak için `false` yap
// (backend lib/cargo.ts + vendor lib/carriers.ts ile uyumlu olsun).
const LOCK_PLATFORM_CARRIER = true

interface SettingsForm {
  name: string
  legal_name: string
  email: string
  phone: string
  description: string
  logo: string
  tax_number: string
  iban: string
  account_holder: string
  default_carrier: '' | CarrierCode
  commission_rate: number
  status: SellerStatus
  is_featured: boolean
}

export function SettingsTab({ seller, hasLogin, onSaved }: { seller: Seller; hasLogin: boolean; onSaved: () => void }) {
  const { notify } = useToast()
  const qc = useQueryClient()
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [form, setForm] = useState<SettingsForm>({
    name: seller.name,
    legal_name: seller.legal_name ?? '',
    email: seller.email ?? '',
    phone: seller.phone ?? '',
    description: seller.description ?? '',
    logo: seller.logo ?? '',
    tax_number: seller.tax_number ?? '',
    iban: seller.iban ?? '',
    account_holder: seller.account_holder ?? '',
    default_carrier: (seller.default_carrier ?? '') as '' | CarrierCode,
    commission_rate: seller.commission_rate,
    status: seller.status,
    is_featured: seller.is_featured ?? false,
  })

  const save = useMutation({
    mutationFn: () =>
      api.post(`/admin/sellers/${seller.id}`, {
        name: form.name.trim(),
        legal_name: form.legal_name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        description: form.description.trim() || null,
        logo: form.logo.trim() || null,
        tax_number: form.tax_number.trim() || null,
        iban: form.iban.trim() || null,
        account_holder: form.account_holder.trim() || null,
        // Kilitliyken kargo firması alanını gönderme (mevcut değer korunur).
        default_carrier: LOCK_PLATFORM_CARRIER ? undefined : (form.default_carrier || null),
        commission_rate: Number(form.commission_rate),
        status: form.status,
        is_featured: form.is_featured,
      }),
    onSuccess: () => { notify('Satıcı bilgileri kaydedildi.'); onSaved() },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const invite = useMutation({
    mutationFn: () => api.post<{ ok: boolean; email: string; created: boolean; reset_link: string }>(`/admin/sellers/${seller.id}/invite`, {}),
    onSuccess: (r) => {
      setInviteLink(r.reset_link)
      notify('Şifre belirleme bağlantısı e-posta ile gönderildi.')
      qc.invalidateQueries({ queryKey: ['seller-detail', seller.id] })
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  function set<K extends keyof SettingsForm>(k: K, v: SettingsForm[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: 880 }}>
      <Section title="Mağaza Bilgileri">
        <Grid>
          <Field label="Satıcı Adı *"><input value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Yasal Unvan"><input value={form.legal_name} onChange={(e) => set('legal_name', e.target.value)} placeholder="Ticari unvan" /></Field>
          <Field label="E-posta"><input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Telefon"><input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="05XX XXX XX XX" /></Field>
          <Field label="Logo URL"><input value={form.logo} onChange={(e) => set('logo', e.target.value)} placeholder="https://..." /></Field>
          <Field label="Durum">
            <select value={form.status} onChange={(e) => set('status', e.target.value as SellerStatus)}>
              <option value="pending">Beklemede</option>
              <option value="active">Aktif</option>
              <option value="suspended">Askıda</option>
            </select>
          </Field>
          <Field label="Mağazada Öne Çıkar">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={(e) => set('is_featured', e.target.checked)}
              />
              Ana sayfa "Öne Çıkan Satıcılar" vitrininde göster
            </label>
          </Field>
        </Grid>
        <Field label="Mağaza Açıklaması">
          <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Mağaza hakkında kısa tanıtım..." />
        </Field>
      </Section>

      <Section title="Komisyon & Kargo">
        <Grid>
          <Field label="Sabit Komisyon Oranı (%)">
            <input type="number" min={0} max={100} value={form.commission_rate}
              onChange={(e) => set('commission_rate', Number(e.target.value))} />
          </Field>
          <Field label="Varsayılan Kargo Firması">
            {LOCK_PLATFORM_CARRIER ? (
              <input type="text" value="Yurtiçi Kargo (anlaşmalı — seçim kapalı)" disabled readOnly />
            ) : (
              <select value={form.default_carrier} onChange={(e) => set('default_carrier', e.target.value as '' | CarrierCode)}>
                <option value="">Seçilmedi</option>
                {CARRIERS.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            )}
          </Field>
        </Grid>
        <p className="muted" style={{ fontSize: '0.78rem', marginTop: '-4px' }}>
          Kategori bazlı komisyon kuralı olan ürünlerde o kural önceliklidir; kural yoksa bu sabit oran uygulanır.
        </p>
      </Section>

      <Section title="Ödeme / Fatura Bilgileri">
        <Grid>
          <Field label="Vergi / TC No"><input value={form.tax_number} onChange={(e) => set('tax_number', e.target.value)} /></Field>
          <Field label="IBAN"><input value={form.iban} onChange={(e) => set('iban', e.target.value)} placeholder="TR.." /></Field>
          <Field label="Hesap Sahibi"><input value={form.account_holder} onChange={(e) => set('account_holder', e.target.value)} /></Field>
        </Grid>
      </Section>

      <Section title="Satıcı Paneli Girişi">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Badge status={hasLogin ? { label: 'Giriş Tanımlı', variant: 'success' } : { label: 'Giriş Yok', variant: 'warning' }} />
          <span className="muted" style={{ fontSize: '0.84rem' }}>
            {hasLogin
              ? 'Satıcının panel girişi mevcut. Aşağıdaki buton yeni bir şifre belirleme bağlantısı gönderir.'
              : 'Satıcının henüz panel girişi yok. Şifre belirleme bağlantısını e-posta ile gönderin.'}
          </span>
        </div>
        {!seller.email && (
          <p style={{ fontSize: '0.82rem', color: 'var(--accent-warning)' }}>
            Bağlantı gönderebilmek için önce satıcıya bir e-posta adresi ekleyip kaydedin.
          </p>
        )}
        <div>
          <button
            className="btn btn--primary"
            disabled={invite.isPending || !seller.email}
            onClick={() => {
              const msg = hasLogin
                ? 'Satıcıya yeni bir şifre belirleme bağlantısı e-posta ile gönderilecek. Devam edilsin mi?'
                : 'Satıcıya panel girişi hazırlanıp şifre belirleme bağlantısı e-posta ile gönderilecek. Devam edilsin mi?'
              if (window.confirm(msg)) invite.mutate()
            }}
          >
            <KeyRound size={16} /> {invite.isPending ? 'Gönderiliyor...' : hasLogin ? 'Şifre Bağlantısı Tekrar Gönder' : 'Şifre Belirleme Bağlantısı Gönder'}
          </button>
        </div>
        {inviteLink && (
          <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
            <div className="muted" style={{ fontSize: '0.76rem', marginBottom: '6px' }}>
              Şifre belirleme bağlantısı (e-posta ile gönderildi — SMTP sorunu olursa elle iletebilirsiniz):
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <code style={{ background: '#0f172a', color: '#fff', padding: '5px 12px', borderRadius: '6px', fontSize: '0.78rem', wordBreak: 'break-all', flex: 1 }}>{inviteLink}</code>
              <button className="btn btn--secondary btn--icon btn--sm" title="Kopyala"
                onClick={() => { navigator.clipboard?.writeText(inviteLink); notify('Bağlantı kopyalandı.') }}>
                <Copy size={14} />
              </button>
            </div>
          </div>
        )}
      </Section>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn--primary" onClick={() => { if (!form.name.trim()) { notify('Satıcı adı zorunludur.', 'error'); return } save.mutate() }} disabled={save.isPending}>
          {save.isPending ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
        </button>
      </div>
    </div>
  )
}
