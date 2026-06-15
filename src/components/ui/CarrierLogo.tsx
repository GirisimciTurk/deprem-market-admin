import { useState } from 'react'

/**
 * Kargo firması logosu. Gerçek logo PNG'leri public/cargo/<kod>.png konumundan
 * yüklenir; dosya yoksa marka renkli badge'e düşer. PNG eklenince otomatik görünür.
 */
type Meta = { label: string; bg: string; fg: string }

const CARRIERS: Record<string, Meta> = {
  yurtici: { label: 'Yurtiçi Kargo', bg: '#f37021', fg: '#fff' },
  aras: { label: 'Aras Kargo', bg: '#005ca9', fg: '#fff' },
  mng: { label: 'MNG Kargo', bg: '#e2001a', fg: '#fff' },
  ptt: { label: 'PTT Kargo', bg: '#005bab', fg: '#ffd200' },
  surat: { label: 'Sürat Kargo', bg: '#c8102e', fg: '#fff' },
  ups: { label: 'UPS', bg: '#351c15', fg: '#ffb500' },
  sendeo: { label: 'Sendeo', bg: '#5b2d90', fg: '#fff' },
  hepsijet: { label: 'Hepsijet', bg: '#ff6000', fg: '#fff' },
  diger: { label: 'Diğer', bg: '#6b7280', fg: '#fff' },
}

/** provider_id ("aras_kargo") ya da düz kod ("yurtici") kabul eder. */
function normalize(code?: string | null): string {
  const c = (code || '').toLowerCase().trim()
  if (!c) return ''
  if (CARRIERS[c]) return c
  const prefix = c.split('_')[0]
  return CARRIERS[prefix] ? prefix : ''
}

export function CarrierLogo({
  code,
  height = 22,
  withLabel = false,
}: {
  code?: string | null
  height?: number
  withLabel?: boolean
}) {
  const c = normalize(code)
  const meta = CARRIERS[c]
  const [err, setErr] = useState(false)
  const label = meta?.label ?? code ?? 'Kargo'

  const badge = (
    <span
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 4,
        padding: '2px 6px',
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
        background: meta?.bg ?? 'var(--bg-tertiary, #eee)',
        color: meta?.fg ?? 'var(--text-secondary, #555)',
      }}
    >
      {label}
    </span>
  )

  if (!c || !meta || err) {
    return withLabel ? (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{badge}</span>
    ) : (
      badge
    )
  }

  const img = (
    <img
      src={`/cargo/${c}.png`}
      alt={label}
      title={label}
      onError={() => setErr(true)}
      style={{ height, width: 'auto', objectFit: 'contain', display: 'block' }}
    />
  )

  return withLabel ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {img}
      <span style={{ fontSize: 13, color: 'var(--text-secondary, #555)' }}>{label}</span>
    </span>
  ) : (
    img
  )
}

export default CarrierLogo
