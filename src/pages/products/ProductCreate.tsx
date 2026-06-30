import { useMemo, useState } from 'react'
import { toReachableImageUrl } from '../../lib/image-url'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Save, Upload, Layers, Package, X } from 'lucide-react'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/toast-context'
import Header from '../../components/layout/Header'
import { api } from '../../lib/api'
import { API_BASE, getToken } from '../../lib/auth'
import { toMinor } from '../../lib/format'

interface OptionDraft {
  title: string
  values: string[]
}

interface VariantValues {
  price: string
  stock: string
  sku: string
  barcode: string
  manageInventory: boolean
}

interface Combo {
  key: string
  label: string
  optionMap: Record<string, string>
}

const emptyVariant = (): VariantValues => ({
  price: '',
  stock: '',
  sku: '',
  barcode: '',
  manageInventory: true,
})

// Seçenek (option) değerlerinin kartezyen çarpımı → her kombinasyon bir varyant.
// Örn: Beden[S,M] × Renk[K,M] → S/K, S/M, M/K, M/M
function buildCombos(options: OptionDraft[]): Combo[] {
  const valid = options.filter((o) => o.title.trim() && o.values.length > 0)
  if (valid.length === 0) return []
  let combos: { title: string; value: string }[][] = [[]]
  for (const opt of valid) {
    const next: { title: string; value: string }[][] = []
    for (const c of combos) {
      for (const val of opt.values) {
        next.push([...c, { title: opt.title.trim(), value: val }])
      }
    }
    combos = next
  }
  return combos.map((c) => ({
    key: c.map((x) => x.value).join('|||'),
    label: c.map((x) => x.value).join(' / '),
    optionMap: Object.fromEntries(c.map((x) => [x.title, x.value])),
  }))
}

export default function ProductCreate() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify } = useToast()

  const [general, setGeneral] = useState({ title: '', description: '', status: 'draft' })
  const [gallery, setGallery] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)

  // Hizmet verilebilir ürün: müşteri sepete eklemenin yanı sıra montaj/uygulama talebi açabilir.
  // Talep havuza düşer; bayiler fiyat verir, admin en düşüğü seçer. (Detaylı ayar: ürün düzenle.)
  const [service, setService] = useState({ is_serviceable: false, service_kind: 'other' })

  // Tek varyantlı (basit) ürün mü, yoksa seçenekli (Beden/Renk) çok-varyantlı mı?
  const [hasVariants, setHasVariants] = useState(false)

  // Seçenekler (yalnız hasVariants iken)
  const [options, setOptions] = useState<OptionDraft[]>([{ title: '', values: [] }])
  const [valueInputs, setValueInputs] = useState<Record<number, string>>({})

  // Tek-varyant alanları (hasVariants kapalıyken)
  const [single, setSingle] = useState<VariantValues>(emptyVariant())

  // Varyant matrisi taslakları — kombinasyon imzasıyla (key) saklanır ki
  // seçenekler değişince girilen değerler korunsun.
  const [variantDrafts, setVariantDrafts] = useState<Record<string, VariantValues>>({})

  const combos = useMemo(() => (hasVariants ? buildCombos(options) : []), [hasVariants, options])

  const { data: locationsData } = useQuery({
    queryKey: ['stock-locations'],
    queryFn: () => api.get<{ stock_locations: { id: string; name: string }[] }>('/admin/stock-locations'),
  })
  const { data: channelsData } = useQuery({
    queryKey: ['sales-channels'],
    queryFn: () => api.get<{ sales_channels: { id: string; name: string }[] }>('/admin/sales-channels'),
  })
  const defaultLocationId = locationsData?.stock_locations?.[0]?.id

  const getDraft = (key: string): VariantValues => variantDrafts[key] ?? emptyVariant()
  const setDraft = (key: string, patch: Partial<VariantValues>) =>
    setVariantDrafts((d) => ({ ...d, [key]: { ...getDraft(key), ...patch } }))

  // --- Görsel yükleme (ProductEdit ile aynı /admin/uploads akışı) ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setIsUploading(true)
    try {
      const token = getToken()
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) formData.append('files', files[i])
      const res = await fetch(`${API_BASE}/admin/uploads`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.message || `Yükleme başarısız (HTTP ${res.status})`)
      }
      const data = (await res.json()) as { files?: { url: string }[] }
      const urls = (data.files ?? []).map((f) => f.url)
      if (urls.length) {
        setGallery((prev) => [...prev, ...urls])
        notify(`${urls.length} görsel yüklendi.`)
      }
    } catch (err: any) {
      notify(err.message || 'Görsel yüklenemedi.', 'error')
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  // --- Seçenek yönetimi ---
  const addOption = () => setOptions((o) => [...o, { title: '', values: [] }])
  const removeOption = (idx: number) => setOptions((o) => o.filter((_, i) => i !== idx))
  const setOptionTitle = (idx: number, title: string) =>
    setOptions((o) => o.map((opt, i) => (i === idx ? { ...opt, title } : opt)))
  const addValue = (idx: number) => {
    const raw = (valueInputs[idx] ?? '').trim()
    if (!raw) return
    // virgülle birden çok değer girilebilir
    const parts = raw.split(',').map((p) => p.trim()).filter(Boolean)
    setOptions((o) =>
      o.map((opt, i) =>
        i === idx ? { ...opt, values: Array.from(new Set([...opt.values, ...parts])) } : opt
      )
    )
    setValueInputs((v) => ({ ...v, [idx]: '' }))
  }
  const removeValue = (idx: number, val: string) =>
    setOptions((o) => o.map((opt, i) => (i === idx ? { ...opt, values: opt.values.filter((x) => x !== val) } : opt)))

  // --- Oluşturma ---
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!general.title.trim()) throw new Error('Ürün başlığı zorunludur.')

      const validOptions = options.filter((o) => o.title.trim() && o.values.length > 0)
      const multi = hasVariants && validOptions.length > 0

      // Medusa, varyant başına en az bir option zorunlu kılar → tek-varyantta
      // gizli "Default" seçeneği kullanılır.
      let optionsPayload: { title: string; values: string[] }[]
      let variantsPayload: any[]

      if (multi) {
        optionsPayload = validOptions.map((o) => ({ title: o.title.trim(), values: o.values }))
        variantsPayload = combos.map((c) => {
          const d = getDraft(c.key)
          const price = parseFloat(d.price)
          return {
            title: c.label,
            sku: d.sku.trim() || undefined,
            barcode: d.barcode.trim() || undefined,
            manage_inventory: d.manageInventory,
            options: c.optionMap,
            prices: Number.isNaN(price) ? [] : [{ amount: toMinor(price), currency_code: 'try' }],
          }
        })
      } else {
        const price = parseFloat(single.price)
        optionsPayload = [{ title: 'Default', values: ['Default'] }]
        variantsPayload = [
          {
            title: 'Standart',
            sku: single.sku.trim() || undefined,
            barcode: single.barcode.trim() || undefined,
            manage_inventory: single.manageInventory,
            options: { Default: 'Default' },
            prices: Number.isNaN(price) ? [] : [{ amount: toMinor(price), currency_code: 'try' }],
          },
        ]
      }

      if (variantsPayload.every((v) => v.prices.length === 0)) {
        throw new Error('En az bir varyant için fiyat girilmelidir.')
      }

      const body: any = {
        title: general.title.trim(),
        description: general.description.trim() || undefined,
        status: general.status,
        thumbnail: gallery[0] || undefined,
        images: gallery.map((url) => ({ url })),
        options: optionsPayload,
        variants: variantsPayload,
        sales_channels: (channelsData?.sales_channels ?? []).map((c) => ({ id: c.id })),
        // Hizmet verilebilir ürün işareti (storefront "Talep Oluştur" + havuz akışı).
        ...(service.is_serviceable
          ? { metadata: { is_serviceable: true, service_kind: service.service_kind } }
          : {}),
      }

      const resp = await api.post<{ product: { id: string } }>('/admin/products', body)
      const productId = resp.product.id

      // Stok seviyelerini ayrıca işle (create envanter kalemini açar, miktarı açmaz).
      const stockByTitle: Record<string, { stock: number; manage: boolean }> = {}
      if (multi) {
        for (const c of combos) {
          const d = getDraft(c.key)
          const n = parseInt(d.stock, 10)
          if (d.manageInventory && !Number.isNaN(n)) stockByTitle[c.label] = { stock: n, manage: true }
        }
      } else {
        const n = parseInt(single.stock, 10)
        if (single.manageInventory && !Number.isNaN(n)) stockByTitle['Standart'] = { stock: n, manage: true }
      }

      if (defaultLocationId && Object.keys(stockByTitle).length > 0) {
        const detail = await api.get<{ product: { variants: { title: string; inventory_items?: { inventory_item_id?: string }[] }[] } }>(
          `/admin/products/${productId}`,
          { fields: '*variants,*variants.inventory_items' }
        )
        for (const v of detail.product.variants ?? []) {
          const target = stockByTitle[v.title]
          const iid = v.inventory_items?.[0]?.inventory_item_id
          if (target && iid) {
            await api.post(`/admin/inventory-items/${iid}/location-levels`, {
              location_id: defaultLocationId,
              stocked_quantity: target.stock,
            }).catch(() => {
              /* envanter seviyesi zaten varsa veya hata olursa ürün yine de oluştu */
            })
          }
        }
      }

      return productId
    },
    onSuccess: (productId) => {
      notify('Ürün oluşturuldu. Detayları düzenleyebilirsiniz.')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      navigate(`/products/${productId}`)
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  return (
    <>
      <Header
        title="Yeni Ürün Oluştur"
        subtitle="Ürün bilgilerini, görsellerini ve varyantlarını girin"
        actions={
          <button className="btn btn--secondary" onClick={() => navigate('/products')}>
            <ArrowLeft size={16} /> Geri Dön
          </button>
        }
      />

      <div style={{ padding: 24, maxWidth: 1000 }} className="animate-fadeIn">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Genel Bilgiler */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid var(--border-primary)', paddingBottom: 10 }}>
              Genel Bilgiler
            </h3>
            <div className="field">
              <label className="field__label">Ürün Başlığı *</label>
              <input
                type="text"
                placeholder="Örn: Profesyonel Deprem Çantası"
                value={general.title}
                onChange={(e) => setGeneral({ ...general, title: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field__label">Açıklama</label>
              <textarea
                rows={4}
                placeholder="Ürün açıklaması..."
                value={general.description}
                onChange={(e) => setGeneral({ ...general, description: e.target.value })}
              />
            </div>
            <div className="field" style={{ maxWidth: 240 }}>
              <label className="field__label">Durum</label>
              <select value={general.status} onChange={(e) => setGeneral({ ...general, status: e.target.value })}>
                <option value="draft">Pasif (Taslak)</option>
                <option value="published">Aktif (Yayında)</option>
              </select>
            </div>

            {/* Hizmet verilebilir ürün */}
            <div style={{ paddingTop: 12, borderTop: '1px solid var(--border-primary)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={service.is_serviceable}
                  onChange={(e) => setService({ ...service, is_serviceable: e.target.checked })}
                  style={{ width: 16, height: 16 }}
                />
                <span style={{ fontWeight: 500 }}>Bu ürün için hizmet/montaj talebi alınabilir</span>
              </label>
              <span className="muted" style={{ fontSize: '0.78rem', marginTop: 6, display: 'block' }}>
                Müşteri ürün sayfasında "Talep Oluştur" görür; talep havuza düşer, bayiler fiyat verir.
                Hizmet türü/açıklaması için kayıttan sonra ürünü düzenleyin.
              </span>
              {service.is_serviceable && (
                <div className="field" style={{ maxWidth: 240, marginTop: 10 }}>
                  <label className="field__label">Hizmet Türü</label>
                  <select value={service.service_kind} onChange={(e) => setService({ ...service, service_kind: e.target.value })}>
                    <option value="other">Genel / Diğer</option>
                    <option value="carbon_fiber">Karbon Fiber Güçlendirme</option>
                    <option value="panic_room">Panik Odası</option>
                    <option value="descent">İniş Aparatı</option>
                    <option value="capsule_bed">Kapsül Yatak</option>
                    <option value="gas_cutoff">Gaz/Elektrik Kesici</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Görseller */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid var(--border-primary)', paddingBottom: 10 }}>
              Görseller
            </h3>
            <div>
              <label className="btn btn--secondary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                {isUploading ? <Spinner size={14} /> : <Upload size={15} />} Görsel Yükle
                <input type="file" accept="image/*" multiple hidden onChange={handleFileUpload} disabled={isUploading} />
              </label>
              <span className="muted" style={{ marginLeft: 12, fontSize: '0.8rem' }}>
                İlk görsel kapak (thumbnail) olur.
              </span>
            </div>
            {gallery.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {gallery.map((url, idx) => (
                  <div key={url} style={{ position: 'relative' }}>
                    <img
                      src={toReachableImageUrl(url)}
                      alt=""
                      style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: idx === 0 ? '2px solid var(--accent-primary)' : '1px solid var(--border-primary)' }}
                    />
                    <button
                      className="btn btn--danger btn--sm"
                      style={{ position: 'absolute', top: -8, right: -8, padding: 2, borderRadius: '50%' }}
                      onClick={() => setGallery((g) => g.filter((_, i) => i !== idx))}
                      title="Kaldır"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Varyant yapısı */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-primary)', paddingBottom: 10 }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={18} /> Fiyat & Varyantlar
              </h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={hasVariants} onChange={(e) => setHasVariants(e.target.checked)} />
                Bu ürünün seçenekleri var (Beden, Renk vb.)
              </label>
            </div>

            {!hasVariants ? (
              // Tek varyant
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <div className="field">
                  <label className="field__label">Fiyat (TRY) *</label>
                  <input type="number" step="0.01" value={single.price} onChange={(e) => setSingle({ ...single, price: e.target.value })} />
                </div>
                <div className="field">
                  <label className="field__label">Stok</label>
                  <input
                    type="number"
                    value={single.manageInventory ? single.stock : ''}
                    disabled={!single.manageInventory}
                    placeholder={single.manageInventory ? '' : 'Sınırsız'}
                    onChange={(e) => setSingle({ ...single, stock: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label className="field__label">SKU (Stok Kodu)</label>
                  <input type="text" value={single.sku} onChange={(e) => setSingle({ ...single, sku: e.target.value })} />
                </div>
                <div className="field">
                  <label className="field__label">Barkod</label>
                  <input type="text" value={single.barcode} onChange={(e) => setSingle({ ...single, barcode: e.target.value })} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', gridColumn: '1 / -1' }}>
                  <input
                    type="checkbox"
                    checked={single.manageInventory}
                    onChange={(e) => setSingle({ ...single, manageInventory: e.target.checked })}
                  />
                  Stok takibi yapılsın (kapalıysa sınırsız satış)
                </label>
              </div>
            ) : (
              <>
                {/* Seçenek tanımları */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {options.map((opt, idx) => (
                    <div key={idx} className="card" style={{ background: 'var(--bg-tertiary)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                        <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                          <label className="field__label">Seçenek Adı</label>
                          <input
                            type="text"
                            placeholder="Örn: Beden"
                            value={opt.title}
                            onChange={(e) => setOptionTitle(idx, e.target.value)}
                          />
                        </div>
                        <button className="btn btn--danger btn--sm" onClick={() => removeOption(idx)} title="Seçeneği sil">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label className="field__label">Değerler (virgülle birden fazla ekleyebilirsiniz)</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            type="text"
                            placeholder="Örn: S, M, L"
                            value={valueInputs[idx] ?? ''}
                            onChange={(e) => setValueInputs((v) => ({ ...v, [idx]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addValue(idx)
                              }
                            }}
                          />
                          <button className="btn btn--secondary" onClick={() => addValue(idx)}>
                            <Plus size={14} /> Ekle
                          </button>
                        </div>
                      </div>
                      {opt.values.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {opt.values.map((val) => (
                            <span
                              key={val}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', padding: '3px 8px', fontSize: '0.8rem' }}
                            >
                              {val}
                              <button onClick={() => removeValue(idx, val)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }} title="Kaldır">
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  <button className="btn btn--secondary btn--sm" style={{ alignSelf: 'flex-start' }} onClick={addOption}>
                    <Plus size={14} /> Seçenek Ekle
                  </button>
                </div>

                {/* Varyant matrisi */}
                {combos.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="muted" style={{ fontSize: '0.82rem' }}>
                      {combos.length} varyant oluşturulacak. Her biri için fiyat/stok girin:
                    </div>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Varyant</th>
                            <th>Fiyat (TRY)</th>
                            <th>Stok</th>
                            <th>SKU</th>
                            <th>Barkod</th>
                          </tr>
                        </thead>
                        <tbody>
                          {combos.map((c) => {
                            const d = getDraft(c.key)
                            return (
                              <tr key={c.key}>
                                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{c.label}</td>
                                <td>
                                  <input type="number" step="0.01" style={{ width: 100 }} value={d.price} onChange={(e) => setDraft(c.key, { price: e.target.value })} />
                                </td>
                                <td>
                                  <input type="number" style={{ width: 80 }} value={d.stock} onChange={(e) => setDraft(c.key, { stock: e.target.value })} />
                                </td>
                                <td>
                                  <input type="text" style={{ width: 110 }} value={d.sku} onChange={(e) => setDraft(c.key, { sku: e.target.value })} />
                                </td>
                                <td>
                                  <input type="text" style={{ width: 110 }} value={d.barcode} onChange={(e) => setDraft(c.key, { barcode: e.target.value })} />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="muted" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Package size={16} /> Varyantların oluşması için en az bir seçenek ve değer girin.
                  </div>
                )}
              </>
            )}
          </div>

          {/* Kaydet */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button className="btn btn--secondary" onClick={() => navigate('/products')}>
              İptal
            </button>
            <button className="btn btn--primary" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? <Spinner size={14} /> : <Save size={15} />} Ürünü Oluştur
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
