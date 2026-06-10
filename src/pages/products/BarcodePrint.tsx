import { useMemo, useState } from 'react'
import JsBarcode from 'jsbarcode'
import { Printer, AlertTriangle } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../components/ui/toast-context'
import type { Product, ProductVariant } from '../../lib/types'
import { formatMoney } from '../../lib/format'

interface Props {
  product: Product
  onClose: () => void
}

/** Varyantın okutulabilir barkod değeri: önce gerçek barkod, yoksa SKU. */
function barcodeValue(v: ProductVariant): string | null {
  const raw = (v.barcode || v.sku || '').trim()
  return raw || null
}

function tryPrice(v: ProductVariant): number | undefined {
  const p = v.prices?.find((x) => x.currency_code?.toLowerCase() === 'try')
  return p?.amount ?? v.prices?.[0]?.amount
}

/**
 * JsBarcode ile değeri SVG'ye çiz, string döndür. 13 haneli ve sağlama hanesi GEÇERLİ ise EAN13,
 * aksi halde CODE128. NOT: JsBarcode geçersiz EAN13'te hata fırlatmaz, sessizce boş çizer →
 * `valid` callback ile yakalayıp CODE128'e düşüyoruz (CODE128 her dizeyi okutulabilir kodlar).
 */
function barcodeSvg(value: string): string {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const opts = { width: 2, height: 48, fontSize: 14, margin: 6, displayValue: true }
  let ok = false
  if (/^\d{13}$/.test(value)) {
    try {
      JsBarcode(svg, value, { format: 'EAN13', ...opts, valid: (v: boolean) => { ok = v } })
    } catch {
      ok = false
    }
  }
  if (!ok) {
    while (svg.firstChild) svg.removeChild(svg.firstChild)
    JsBarcode(svg, value, { format: 'CODE128', ...opts })
  }
  return new XMLSerializer().serializeToString(svg)
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export default function BarcodePrint({ product, onClose }: Props) {
  const { notify } = useToast()
  const variants = product.variants ?? []
  const [variantId, setVariantId] = useState(variants[0]?.id ?? '')
  const [quantity, setQuantity] = useState(24)

  const variant = useMemo(() => variants.find((v) => v.id === variantId), [variants, variantId])
  const value = variant ? barcodeValue(variant) : null
  const price = variant ? tryPrice(variant) : undefined

  const handlePrint = () => {
    if (!variant || !value) {
      notify('Bu varyantta barkod veya SKU yok, etiket basılamaz.', 'error')
      return
    }
    const count = Math.max(1, Math.min(500, Math.floor(quantity) || 1))
    let svg: string
    try {
      svg = barcodeSvg(value)
    } catch {
      notify('Barkod oluşturulamadı (değer geçersiz olabilir).', 'error')
      return
    }

    const name = escapeHtml(product.title + (variant.title && variant.title !== 'Default variant' ? ` · ${variant.title}` : ''))
    const priceLabel = typeof price === 'number' ? escapeHtml(formatMoney(price)) : ''
    const label = `
      <div class="label">
        <div class="name">${name}</div>
        <div class="bc">${svg}</div>
        ${priceLabel ? `<div class="price">${priceLabel}</div>` : ''}
      </div>`
    const labels = Array.from({ length: count }, () => label).join('')

    const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8">
      <title>Barkod — ${name}</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, Helvetica, sans-serif; }
        .sheet { display: flex; flex-wrap: wrap; gap: 4mm; padding: 8mm; }
        .label {
          width: 50mm; height: 30mm; border: 1px dashed #bbb; border-radius: 2px;
          padding: 2mm; display: flex; flex-direction: column; align-items: center;
          justify-content: space-between; page-break-inside: avoid; overflow: hidden;
        }
        .name { font-size: 8pt; font-weight: 600; text-align: center; line-height: 1.1;
          max-height: 7mm; overflow: hidden; }
        .bc { display: flex; align-items: center; justify-content: center; }
        .bc svg { max-width: 100%; height: auto; }
        .price { font-size: 11pt; font-weight: 700; }
        @media print {
          .label { border-color: transparent; }
          @page { size: A4; margin: 6mm; }
        }
      </style></head>
      <body><div class="sheet">${labels}</div>
      <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 150); };</script>
      </body></html>`

    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) {
      notify('Yazdırma penceresi açılamadı (açılır pencere engellenmiş olabilir).', 'error')
      return
    }
    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  return (
    <Modal title="Barkod Yazdır" size="md" onClose={onClose}>
      <div style={{ fontSize: '0.875rem', marginBottom: 16 }}>
        <strong>{product.title}</strong>
      </div>

      {variants.length > 1 && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 6 }}>
            Varyant
          </label>
          <select value={variantId} onChange={(e) => setVariantId(e.target.value)} style={{ width: '100%' }}>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title || v.sku || v.id}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 6 }}>
          Etiket adedi
        </label>
        <input
          type="number"
          min={1}
          max={500}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      <div className="card" style={{ marginBottom: 16, fontSize: '0.82rem', lineHeight: 1.7 }}>
        <div>
          Barkod değeri:{' '}
          <strong>{value ?? '—'}</strong>
          {variant && !variant.barcode && value && <span className="muted"> (SKU'dan)</span>}
        </div>
        <div>Fiyat: <strong>{typeof price === 'number' ? formatMoney(price) : '—'}</strong></div>
      </div>

      {!value && (
        <div
          style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--warning, #d97706)', fontSize: '0.82rem', marginBottom: 14 }}
        >
          <AlertTriangle size={15} /> Bu varyantta barkod/SKU tanımlı değil. Ürün düzenlemeden barkod girin.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button className="btn btn--secondary" onClick={onClose}>
          Kapat
        </button>
        <button className="btn btn--primary" disabled={!value} onClick={handlePrint}>
          <Printer size={15} /> Yazdır ({Math.max(1, Math.min(500, Math.floor(quantity) || 1))} adet)
        </button>
      </div>
    </Modal>
  )
}
