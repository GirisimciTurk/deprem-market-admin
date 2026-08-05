import { useEffect, useState } from 'react'
import { ShieldCheck, Plus, X, FileText, Check } from 'lucide-react'
import { api } from '../../lib/api'
import { useToast } from '../../components/ui/toast-context'
import { Spinner } from '../../components/ui/Spinner'

type Cert = {
  label: string
  authority: string
  document_url: string
  verified: boolean
}

/**
 * Ürün sertifikaları — admin yönetimi. Satıcı yalnız "beyan" girer (verified=false);
 * bir sertifikayı "Doğrulanmış" yapan TEK yetkili yol burasıdır. Kendi kendine yeterli:
 * /admin/products/:id/certifications GET/POST ile çalışır (ProductEdit save akışından bağımsız).
 */
export default function CertificationsManager({ productId }: { productId?: string }) {
  const { notify } = useToast()
  const [certs, setCerts] = useState<Cert[]>([])
  // Başlangıç değeri productId'den TÜRETİLİYOR: ürün yoksa yüklenecek bir şey de
  // yok. Önceden `true` başlayıp effect'in ilk satırında senkron setLoading(false)
  // çağrılıyordu — gereksiz bir ekstra render turu (react-hooks/set-state-in-effect).
  const [loading, setLoading] = useState(Boolean(productId))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!productId) return
    let active = true
    api
      .get<{ certifications: any[] }>(`/admin/products/${productId}/certifications`)
      .then((r) => {
        if (!active) return
        setCerts(
          (r.certifications || []).map((c) => ({
            label: c?.label || '',
            authority: c?.authority || '',
            document_url: c?.document_url || '',
            verified: c?.verified === true,
          }))
        )
      })
      .catch(() => active && setCerts([]))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [productId])

  const update = (i: number, patch: Partial<Cert>) =>
    setCerts((c) => c.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  const add = () =>
    setCerts((c) => [...c, { label: '', authority: '', document_url: '', verified: false }])
  const remove = (i: number) => setCerts((c) => c.filter((_, idx) => idx !== i))

  const save = async () => {
    if (!productId) return
    setSaving(true)
    try {
      const payload = certs
        .map((c) => ({
          label: c.label.trim(),
          authority: c.authority.trim() || undefined,
          document_url: c.document_url.trim() || undefined,
          verified: c.verified,
        }))
        .filter((c) => c.label)
      const r = await api.post<{ certifications: any[] }>(
        `/admin/products/${productId}/certifications`,
        { certifications: payload }
      )
      setCerts(
        (r.certifications || []).map((c) => ({
          label: c?.label || '',
          authority: c?.authority || '',
          document_url: c?.document_url || '',
          verified: c?.verified === true,
        }))
      )
      notify('Sertifikalar kaydedildi.', 'success')
    } catch (e: any) {
      notify(e?.message || 'Kaydedilemedi.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!productId) return null
  if (loading) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        Satıcı beyanları burada listelenir. Belgeyi inceleyip <strong>Doğrulandı</strong> işaretlerseniz,
        ürün sayfasında yeşil "Doğrulanmış" rozeti gösterilir. İşaretlemezseniz "Üretici beyanı" olarak kalır.
      </p>

      {certs.map((cert, i) => (
        <div
          key={i}
          style={{
            border: '1px solid var(--border-primary)',
            borderRadius: 8,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Sertifika {i + 1}</span>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => remove(i)}>
              <X size={14} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input
              type="text"
              placeholder="Standart (ör. CE, TSE, ISO 13485)"
              value={cert.label}
              maxLength={80}
              onChange={(e) => update(i, { label: e.target.value })}
            />
            <input
              type="text"
              placeholder="Veren kurum (opsiyonel)"
              value={cert.authority}
              maxLength={80}
              onChange={(e) => update(i, { authority: e.target.value })}
            />
          </div>
          <input
            type="text"
            placeholder="Belge URL (opsiyonel)"
            value={cert.document_url}
            onChange={(e) => update(i, { document_url: e.target.value })}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {cert.document_url && (
              <a
                href={cert.document_url}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.8rem' }}
              >
                <FileText size={14} /> Belgeyi aç
              </a>
            )}
            <button
              type="button"
              onClick={() => update(i, { verified: !cert.verified })}
              className={`btn btn--sm ${cert.verified ? 'btn--primary' : 'btn--secondary'}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {cert.verified ? <Check size={14} /> : <ShieldCheck size={14} />}
              {cert.verified ? 'Doğrulandı' : 'Doğrula'}
            </button>
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="btn btn--secondary" onClick={add} disabled={certs.length >= 15}>
          <Plus size={16} /> Sertifika Ekle
        </button>
        <button type="button" className="btn btn--primary" onClick={save} disabled={saving}>
          {saving ? <Spinner size={14} /> : <Check size={16} />} Kaydet
        </button>
      </div>
    </div>
  )
}
