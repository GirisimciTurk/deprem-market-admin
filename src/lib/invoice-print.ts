import { formatMoney } from './format'

// Yazdırılabilir / PDF fatura görünümü. Yeni pencerede temiz A4 Türkçe fatura
// açar ve tarayıcının yazdır iletişimini tetikler (kullanıcı "PDF olarak kaydet"
// ile PDF alabilir). Entegratör/lib gerektirmez; manuel kesim için veri çıktısıdır.

interface PrintLine {
  name: string
  quantity: number
  unit_price_gross: number
  line_net: number
  line_kdv: number
  kdv_rate: number
  line_gross: number
}

export interface PrintableInvoice {
  type: 'sale' | 'commission'
  draft_number: string
  invoice_number: string | null
  issue_date: string
  issuer_name: string
  issuer_tax_number: string | null
  recipient_name: string
  recipient_tax_number: string | null
  recipient_email: string | null
  recipient_address: Record<string, unknown> | null
  display_id: number | null
  currency_code: string
  net_total: number
  tax_total: number
  grand_total: number
  tax_rate: number
  lines: PrintLine[] | null
}

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatAddress(address: Record<string, unknown> | null): string {
  if (!address) return ''
  const order = ['address', 'address_1', 'address_2', 'district', 'neighborhood', 'city', 'province', 'postal_code', 'country', 'country_code']
  const seen = new Set<string>()
  const parts: string[] = []
  for (const key of order) {
    const v = address[key]
    if (typeof v === 'string' && v.trim()) { parts.push(v.trim()); seen.add(key) }
  }
  for (const [key, v] of Object.entries(address)) {
    if (seen.has(key)) continue
    if (typeof v === 'string' && v.trim()) parts.push(v.trim())
    else if (typeof v === 'number') parts.push(String(v))
  }
  return parts.join(', ')
}

export function printInvoice(inv: PrintableInvoice) {
  const cur = inv.currency_code
  const typeLabel = inv.type === 'commission' ? 'KOMİSYON FATURASI' : 'SATIŞ FATURASI'
  const dateStr = new Date(inv.issue_date).toLocaleDateString('tr-TR')
  const addr = formatAddress(inv.recipient_address)
  const lines = inv.lines ?? []

  const rows = lines
    .map(
      (l) => `<tr>
        <td>${esc(l.name)}</td>
        <td class="r">${esc(l.quantity)}</td>
        <td class="r">${esc(formatMoney(l.unit_price_gross, cur))}</td>
        <td class="r">${esc(formatMoney(l.line_net, cur))}</td>
        <td class="r">${esc(formatMoney(l.line_kdv, cur))} <span class="muted">%${esc(l.kdv_rate)}</span></td>
        <td class="r b">${esc(formatMoney(l.line_gross, cur))}</td>
      </tr>`
    )
    .join('')

  const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8">
<title>Fatura ${esc(inv.invoice_number || inv.draft_number)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 32px; font-size: 13px; }
  .wrap { max-width: 800px; margin: 0 auto; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #F08C1A; padding-bottom: 16px; margin-bottom: 24px; }
  .brand { font-size: 22px; font-weight: 800; color: #F08C1A; }
  .doc { text-align: right; }
  .doc .t { font-size: 16px; font-weight: 700; letter-spacing: .5px; }
  .doc .n { font-size: 13px; margin-top: 4px; }
  .muted { color: #777; }
  .parties { display: flex; gap: 24px; margin-bottom: 24px; }
  .party { flex: 1; border: 1px solid #ddd; border-radius: 8px; padding: 12px 14px; }
  .party h4 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #777; }
  .party .name { font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { padding: 8px 10px; border-bottom: 1px solid #eee; text-align: left; }
  th { background: #faf6f0; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #555; }
  td.r, th.r { text-align: right; }
  td.b { font-weight: 700; }
  .totals { width: 280px; margin-left: auto; }
  .totals .row { display: flex; justify-content: space-between; padding: 5px 0; }
  .totals .grand { border-top: 2px solid #333; margin-top: 4px; padding-top: 8px; font-size: 15px; font-weight: 800; color: #F08C1A; }
  .foot { margin-top: 32px; padding-top: 12px; border-top: 1px solid #eee; font-size: 11px; color: #999; }
  @media print { body { padding: 0; } @page { margin: 16mm; } }
</style></head>
<body><div class="wrap">
  <div class="top">
    <div><div class="brand">depremtek.market</div><div class="muted" style="margin-top:4px">${esc(inv.issuer_name)}</div></div>
    <div class="doc">
      <div class="t">${typeLabel}</div>
      <div class="n">Belge No: <b>${esc(inv.invoice_number || inv.draft_number)}</b></div>
      ${inv.invoice_number && inv.draft_number !== inv.invoice_number ? `<div class="n muted">Taslak: ${esc(inv.draft_number)}</div>` : ''}
      <div class="n">Tarih: ${esc(dateStr)}</div>
      ${inv.display_id != null ? `<div class="n muted">Sipariş #${esc(inv.display_id)}</div>` : ''}
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h4>Düzenleyen</h4>
      <div class="name">${esc(inv.issuer_name)}</div>
      ${inv.issuer_tax_number ? `<div class="muted">VKN/TCKN: ${esc(inv.issuer_tax_number)}</div>` : ''}
    </div>
    <div class="party">
      <h4>Alıcı</h4>
      <div class="name">${esc(inv.recipient_name)}</div>
      ${inv.recipient_tax_number ? `<div class="muted">VKN/TCKN: ${esc(inv.recipient_tax_number)}</div>` : ''}
      ${inv.recipient_email ? `<div class="muted">${esc(inv.recipient_email)}</div>` : ''}
      ${addr ? `<div class="muted">${esc(addr)}</div>` : ''}
    </div>
  </div>

  <table>
    <thead><tr>
      <th>Açıklama</th><th class="r">Adet</th><th class="r">Birim Fiyat</th>
      <th class="r">Net</th><th class="r">KDV</th><th class="r">Tutar</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="6" class="muted" style="text-align:center;padding:20px">Kalem yok.</td></tr>`}</tbody>
  </table>

  <div class="totals">
    <div class="row"><span class="muted">Net Toplam</span><span>${esc(formatMoney(inv.net_total, cur))}</span></div>
    <div class="row"><span class="muted">KDV (%${esc(inv.tax_rate)})</span><span>${esc(formatMoney(inv.tax_total, cur))}</span></div>
    <div class="row grand"><span>Genel Toplam</span><span>${esc(formatMoney(inv.grand_total, cur))}</span></div>
  </div>

  <div class="foot">
    Bu belge depremtek.market üzerinden ${esc(dateStr)} tarihinde oluşturulmuştur. Fiyatlar KDV dahildir.
    ${!inv.invoice_number ? 'Resmi fatura numarası girilmemiştir (taslak).' : ''}
  </div>
</div>
<script>window.onload = function () { setTimeout(function(){ window.print() }, 250) }</script>
</body></html>`

  const w = window.open('', '_blank', 'width=900,height=1000')
  if (!w) {
    alert('Yazdırma penceresi açılamadı. Tarayıcı açılır pencere engelini kontrol edin.')
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
}
