import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Save,
  Plus,
  Trash2,
  Settings,
  Barcode,
  Eye,
  ArrowLeft,
  Calendar,
  Layers,
  Globe,
  Image as ImageIcon,
  Compass,
  Sparkles,
  AlertTriangle,
  Upload,
} from 'lucide-react'
import { Spinner, LoadingState } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/StateBox'
import { useToast } from '../../components/ui/toast-context'
import Header from '../../components/layout/Header'
import Badge from '../../components/ui/Badge'
import { productStatus } from '../../lib/statusLabels'
import { api } from '../../lib/api'
import { API_BASE, getToken } from '../../lib/auth'
import { toMajor, toMinor } from '../../lib/format'
import type { MoneyAmount } from '../../lib/types'

type TabType = 'details' | 'physical' | 'gallery' | 'variants' | 'showcase'

interface ShowcaseFeature {
  iconName: string
  title: string
  desc: string
}

interface ShowcaseSpec {
  label: string
  value: string
}

interface ShowcaseHighlight {
  title: string
  desc: string
  image: string
}

interface InvLevel {
  id: string
  location_id: string
  stocked_quantity: number
}
interface InvLink {
  inventory_item_id?: string
  inventory?: { id?: string; location_levels?: InvLevel[] }
}
interface DetailVariant {
  id: string
  title?: string
  sku?: string | null
  barcode?: string | null
  manage_inventory?: boolean
  prices?: MoneyAmount[]
  inventory_quantity?: number | null
  inventory_items?: InvLink[]
}

interface ProductImage {
  id: string
  url: string
}

interface DetailResponse {
  product: {
    id: string
    title: string
    description?: string | null
    handle?: string
    status?: string
    thumbnail?: string | null
    weight?: number | null
    length?: number | null
    width?: number | null
    height?: number | null
    material?: string | null
    origin_country?: string | null
    created_at?: string
    variants?: DetailVariant[]
    images?: ProductImage[]
    metadata?: Record<string, any> | null
  }
}

const DETAIL_FIELDS =
  'id,title,description,handle,status,thumbnail,weight,length,width,height,material,origin_country,created_at,metadata,*images,*variants,*variants.manage_inventory,*variants.sku,*variants.barcode,*variants.prices,*variants.inventory_items,*variants.inventory_items.inventory,*variants.inventory_items.inventory.location_levels'

function tryPriceAmount(prices?: MoneyAmount[]): number | undefined {
  return prices?.find((p) => p.currency_code?.toLowerCase() === 'try')?.amount ?? prices?.[0]?.amount
}

function firstLevel(variant: DetailVariant, targetLocationId?: string): { inventoryItemId?: string; level?: InvLevel } {
  const link = variant.inventory_items?.[0]
  const inventoryItemId = link?.inventory_item_id ?? link?.inventory?.id
  const levels = link?.inventory?.location_levels ?? []
  
  const level = targetLocationId 
    ? levels.find((l) => l.location_id === targetLocationId) || levels[0]
    : levels[0]

  return { inventoryItemId, level }
}

export default function ProductEdit() {
  const { id: productId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify } = useToast()

  // Tab State
  const [activeTab, setActiveTab] = useState<TabType>('details')

  // Genel Detaylar Form State
  const [generalForm, setGeneralForm] = useState({
    title: '',
    handle: '',
    description: '',
    status: 'draft',
    thumbnail: '',
  })

  // Fiziksel Özellikler Form State
  const [physicalForm, setPhysicalForm] = useState({
    material: '',
    origin_country: '',
    weight: 0,
    length: 0,
    width: 0,
    height: 0,
    critical_threshold: 10,
  })

  // Galeri Resimleri State
  const [galleryImages, setGalleryImages] = useState<string[]>([])
  const [newGalleryUrl, setNewGalleryUrl] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  // Showcase & Multimedya State (stored in metadata)
  const [showcaseForm, setShowcaseForm] = useState({
    tagline: '',
    video_url: '',
  })
  
  const [showcaseFeatures, setShowcaseFeatures] = useState<ShowcaseFeature[]>([])
  const [newFeature, setNewFeature] = useState<ShowcaseFeature>({ iconName: 'Shield', title: '', desc: '' })

  const [showcaseSpecs, setShowcaseSpecs] = useState<ShowcaseSpec[]>([])
  const [newSpec, setNewSpec] = useState<ShowcaseSpec>({ label: '', value: '' })

  const [showcaseHighlights, setShowcaseHighlights] = useState<ShowcaseHighlight[]>([])
  const [newHighlight, setNewHighlight] = useState<ShowcaseHighlight>({ title: '', desc: '', image: '' })

  // Variants drafts state
  const [variantDrafts, setVariantDrafts] = useState<Record<string, { price: string; stock: string; sku: string; barcode: string }>>({})

  // Load stock locations
  const { data: locationsData } = useQuery({
    queryKey: ['stock-locations'],
    queryFn: async () => {
      return await api.get<{ stock_locations: { id: string; name: string }[] }>('/admin/stock-locations')
    },
  })

  // Load product data
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const response = await api.get<DetailResponse>(`/admin/products/${productId}`, { fields: DETAIL_FIELDS })
      if (response?.product) {
        // Initialize general form
        setGeneralForm({
          title: response.product.title || '',
          handle: response.product.handle || '',
          description: response.product.description || '',
          status: response.product.status || 'draft',
          thumbnail: response.product.thumbnail || '',
        })

        // Initialize physical form
        setPhysicalForm({
          material: response.product.material || '',
          origin_country: response.product.origin_country || '',
          weight: response.product.weight || 0,
          length: response.product.length || 0,
          width: response.product.width || 0,
          height: response.product.height || 0,
          critical_threshold: Number(response.product.metadata?.critical_threshold) || 10,
        })

        // Initialize gallery images
        setGalleryImages(response.product.images?.map((img) => img.url) || [])

        // Initialize showcase metadata
        const metadata = response.product.metadata || {}
        setShowcaseForm({
          tagline: metadata.tagline || '',
          video_url: metadata.video_url || '',
        })
        setShowcaseFeatures(metadata.features || [])
        setShowcaseSpecs(metadata.specs || [])
        setShowcaseHighlights(metadata.highlights || [])
      }
      return response
    },
    enabled: !!productId,
  })

  const product = data?.product
  const variants = useMemo(() => product?.variants ?? [], [product])

  const defaultLocationId = locationsData?.stock_locations?.[0]?.id

  // Get drafts state for variants
  const getVariantDraft = (v: DetailVariant) => {
    const existing = variantDrafts[v.id]
    if (existing) return existing
    const price = tryPriceAmount(v.prices)
    const { level } = firstLevel(v, defaultLocationId)
    const allLevels = v.inventory_items?.[0]?.inventory?.location_levels ?? []
    const totalStockVal = allLevels.reduce((s: number, l: any) => s + (l.stocked_quantity ?? 0), 0)

    return {
      price: price !== undefined ? String(toMajor(price)) : '',
      stock: level ? String(level.stocked_quantity) : String(totalStockVal),
      sku: v.sku || '',
      barcode: v.barcode || '',
    }
  }

  const setVariantDraft = (id: string, patch: Partial<{ price: string; stock: string; sku: string; barcode: string }>) => {
    setVariantDrafts((d) => ({
      ...d,
      [id]: {
        ...getVariantDraft(variants.find((v) => v.id === id)!),
        ...d[id],
        ...patch,
      },
    }))
  }

  // Global details and showcase update mutation
  const updateProductMutation = useMutation({
    mutationFn: async () => {
      // 1. Prepare images format for Medusa API
      const imagesPayload = galleryImages.map((url) => ({ url }))

      // 2. Prepare metadata format
      const metadataPayload = {
        ...(product?.metadata || {}),
        tagline: showcaseForm.tagline,
        video_url: showcaseForm.video_url,
        features: showcaseFeatures,
        specs: showcaseSpecs,
        highlights: showcaseHighlights,
        critical_threshold: Number(physicalForm.critical_threshold) || 10,
      }

      await api.post(`/admin/products/${productId}`, {
        title: generalForm.title,
        handle: generalForm.handle || undefined,
        description: generalForm.description,
        status: generalForm.status,
        thumbnail: generalForm.thumbnail || null,
        
        // Physical fields
        material: physicalForm.material || null,
        origin_country: physicalForm.origin_country || null,
        weight: Number(physicalForm.weight) || 0,
        length: Number(physicalForm.length) || null,
        width: Number(physicalForm.width) || null,
        height: Number(physicalForm.height) || null,

        // Media gallery
        images: imagesPayload,

        // Custom showcase metadata
        metadata: metadataPayload,
      })
    },
    onSuccess: () => {
      notify('Ürün ayarları başarıyla kaydedildi.')
      queryClient.invalidateQueries({ queryKey: ['product', productId] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  // Variants update mutation
  const saveVariantMutation = useMutation({
    mutationFn: async (variant: DetailVariant) => {
      const draft = getVariantDraft(variant)
      const newPrice = parseFloat(draft.price)
      const newStock = parseInt(draft.stock, 10)

      const updateData: any = {
        sku: draft.sku || null,
        barcode: draft.barcode || null,
      }

      if (!Number.isNaN(newPrice)) {
        const others = (variant.prices ?? []).filter((p) => p.currency_code?.toLowerCase() !== 'try')
        updateData.prices = [
          ...others.map((p) => ({ amount: p.amount, currency_code: p.currency_code })),
          { amount: toMinor(newPrice), currency_code: 'try' },
        ]
      }

      await api.post(`/admin/products/${productId}/variants/${variant.id}`, updateData)

      if (variant.manage_inventory && !Number.isNaN(newStock) && defaultLocationId) {
        const { inventoryItemId, level } = firstLevel(variant, defaultLocationId)
        if (inventoryItemId) {
          if (level) {
            await api.post(`/admin/inventory-items/${inventoryItemId}/location-levels/${level.location_id}`, {
              stocked_quantity: newStock,
            })
          } else {
            await api.post(`/admin/inventory-items/${inventoryItemId}/location-levels`, {
              location_id: defaultLocationId,
              stocked_quantity: newStock,
            })
          }
        }
      }
    },
    onSuccess: () => {
      notify('Varyant detayları ve envanter kaydedildi.')
      queryClient.invalidateQueries({ queryKey: ['product', productId] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  // Gallery image actions
  const handleAddGalleryImage = () => {
    if (!newGalleryUrl) return
    if (galleryImages.includes(newGalleryUrl)) {
      notify('Bu resim zaten galeride ekli.', 'warning')
      return
    }
    setGalleryImages([...galleryImages, newGalleryUrl])
    setNewGalleryUrl('')
    notify('Resim galeri listesine eklendi (Kaydet butonuna basmayı unutmayın).')
  }

  const handleDeleteGalleryImage = (index: number) => {
    const updated = galleryImages.filter((_, idx) => idx !== index)
    setGalleryImages(updated)
    notify('Resim listeden kaldırıldı (Kaydet butonuna basmayı unutmayın).')
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    try {
      const token = getToken()
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i])
      }

      const res = await fetch(`${API_BASE}/admin/uploads`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.message || `Yükleme başarısız (HTTP ${res.status})`)
      }

      const data = await res.json() as { files?: { url: string; key: string }[] }
      if (data.files && data.files.length > 0) {
        const urls = data.files.map((f) => f.url)
        setGalleryImages((prev) => [...prev, ...urls])
        notify(`${urls.length} adet görsel başarıyla yüklendi ve WebP'ye dönüştürüldü. (Kaydet butonuna basmayı unutmayın)`)
      }
    } catch (err: any) {
      notify(err.message || 'Görsel yüklenirken bir hata oluştu.', 'error')
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  // Showcase features actions
  const handleAddFeature = () => {
    if (!newFeature.title || !newFeature.desc) {
      notify('Lütfen özellik başlığını ve açıklamasını girin.', 'warning')
      return
    }
    setShowcaseFeatures([...showcaseFeatures, newFeature])
    setNewFeature({ iconName: 'Shield', title: '', desc: '' })
    notify('Özellik listeye eklendi (Kaydet butonuna basmayı unutmayın).')
  }

  const handleDeleteFeature = (idx: number) => {
    const updated = showcaseFeatures.filter((_, i) => i !== idx)
    setShowcaseFeatures(updated)
  }

  // Showcase Specs actions
  const handleAddSpec = () => {
    if (!newSpec.label || !newSpec.value) {
      notify('Lütfen özellik adı ve değerini girin.', 'warning')
      return
    }
    setShowcaseSpecs([...showcaseSpecs, newSpec])
    setNewSpec({ label: '', value: '' })
  }

  const handleDeleteSpec = (idx: number) => {
    const updated = showcaseSpecs.filter((_, i) => i !== idx)
    setShowcaseSpecs(updated)
  }

  // Showcase highlights actions
  const handleAddHighlight = () => {
    if (!newHighlight.title || !newHighlight.desc || !newHighlight.image) {
      notify('Lütfen başlık, açıklama ve resim URL girin.', 'warning')
      return
    }
    setShowcaseHighlights([...showcaseHighlights, newHighlight])
    setNewHighlight({ title: '', desc: '', image: '' })
  }

  const handleDeleteHighlight = (idx: number) => {
    const updated = showcaseHighlights.filter((_, i) => i !== idx)
    setShowcaseHighlights(updated)
  }

  const formattedDate = product?.created_at
    ? new Date(product.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '-'

  return (
    <>
      <Header
        title="Ürün Detayları ve Gelişmiş Ayarlar"
        subtitle={product?.title || 'Yükleniyor...'}
        actions={
          <button className="btn btn--secondary" onClick={() => navigate('/products')}>
            <ArrowLeft size={16} /> Geri Dön
          </button>
        }
      />

      <div style={{ padding: '24px' }} className="animate-fadeIn">
        {isLoading ? (
          <LoadingState label="Ürün özellikleri yükleniyor..." />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 0.55fr', gap: '24px', alignItems: 'flex-start' }}>
            
            {/* Left Column: Form Settings and Tabs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Scrollable Tabs Bar */}
              <div className="tabs-navigation" style={{ marginBottom: 4, overflowX: 'auto', whiteSpace: 'nowrap' }}>
                <button
                  className={`tabs-navigation__btn ${activeTab === 'details' ? 'active' : ''}`}
                  onClick={() => setActiveTab('details')}
                >
                  <Settings size={15} /> Genel Bilgiler
                </button>
                <button
                  className={`tabs-navigation__btn ${activeTab === 'physical' ? 'active' : ''}`}
                  onClick={() => setActiveTab('physical')}
                >
                  <Compass size={15} /> Fiziksel & Nitelik
                </button>
                <button
                  className={`tabs-navigation__btn ${activeTab === 'gallery' ? 'active' : ''}`}
                  onClick={() => setActiveTab('gallery')}
                >
                  <ImageIcon size={15} /> Ürün Galerisi ({galleryImages.length})
                </button>
                <button
                  className={`tabs-navigation__btn ${activeTab === 'variants' ? 'active' : ''}`}
                  onClick={() => setActiveTab('variants')}
                >
                  <Barcode size={15} /> Fiyat, SKU & Stok
                </button>
                <button
                  className={`tabs-navigation__btn ${activeTab === 'showcase' ? 'active' : ''}`}
                  onClick={() => setActiveTab('showcase')}
                >
                  <Sparkles size={15} /> Showcase & Vitrin
                </button>
              </div>

              {/* Tab 1: General Details Form */}
              {activeTab === 'details' && (
                <div className="card animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid var(--border-primary)', paddingBottom: 10 }}>
                    Genel Detaylar
                  </h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div className="field">
                      <label className="field__label">Ürün Adı</label>
                      <input
                        type="text"
                        value={generalForm.title}
                        onChange={(e) => setGeneralForm({ ...generalForm, title: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label className="field__label">URL Uzantısı (Handle)</label>
                      <input
                        type="text"
                        value={generalForm.handle}
                        onChange={(e) => setGeneralForm({ ...generalForm, handle: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label className="field__label">Durum (Status)</label>
                    <select
                      value={generalForm.status}
                      onChange={(e) => setGeneralForm({ ...generalForm, status: e.target.value })}
                    >
                      <option value="published">Aktif (Yayında)</option>
                      <option value="draft">Pasif (Taslak)</option>
                    </select>
                  </div>

                  <div className="field">
                    <label className="field__label">Küçük Görsel URL (Thumbnail)</label>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="https://..."
                        value={generalForm.thumbnail}
                        onChange={(e) => setGeneralForm({ ...generalForm, thumbnail: e.target.value })}
                        style={{ flex: 1 }}
                      />
                      <div style={{ position: 'relative', overflow: 'hidden' }}>
                        <button className="btn btn--secondary" type="button" style={{ height: 38, whiteSpace: 'nowrap' }} disabled={isUploading}>
                          <Upload size={14} /> {isUploading ? 'Yükleniyor...' : 'Dosya Yükle'}
                        </button>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const files = e.target.files
                            if (!files || files.length === 0) return
                            setIsUploading(true)
                            try {
                              const token = getToken()
                              const formData = new FormData()
                              formData.append('files', files[0])
                              const res = await fetch(`${API_BASE}/admin/uploads`, {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${token}` },
                                body: formData,
                              })
                              if (!res.ok) throw new Error('Yükleme başarısız')
                              const data = await res.json()
                              if (data.files?.[0]?.url) {
                                setGeneralForm({ ...generalForm, thumbnail: data.files[0].url })
                                notify("Ana görsel başarıyla yüklendi ve WebP'ye dönüştürüldü.")
                              }
                            } catch (err: any) {
                              notify('Görsel yüklenirken bir hata oluştu.', 'error')
                            } finally {
                              setIsUploading(false)
                            }
                          }}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            opacity: 0,
                            cursor: 'pointer',
                            width: '100%',
                            height: '100%'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="field">
                    <label className="field__label">Açıklama (Description)</label>
                    <textarea
                      rows={8}
                      value={generalForm.description}
                      onChange={(e) => setGeneralForm({ ...generalForm, description: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-primary)', paddingTop: 14 }}>
                    <button
                      className="btn btn--primary"
                      disabled={updateProductMutation.isPending}
                      onClick={() => updateProductMutation.mutate()}
                    >
                      {updateProductMutation.isPending ? <Spinner size={14} /> : <Save size={15} />} Bilgileri Kaydet
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 2: Physical & Technical Specs */}
              {activeTab === 'physical' && (
                <div className="card animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid var(--border-primary)', paddingBottom: 10 }}>
                    Fiziksel Özellikler ve Nitelikler
                  </h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div className="field">
                      <label className="field__label">Kullanılan Malzeme (Material)</label>
                      <input
                        type="text"
                        placeholder="Örn: 1000D Oxford Kumaş, Metal"
                        value={physicalForm.material}
                        onChange={(e) => setPhysicalForm({ ...physicalForm, material: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label className="field__label">Üretim Ülkesi (Origin Country)</label>
                      <input
                        type="text"
                        placeholder="Örn: TR"
                        value={physicalForm.origin_country}
                        onChange={(e) => setPhysicalForm({ ...physicalForm, origin_country: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    <div className="field">
                      <label className="field__label">Ağırlık (Gram)</label>
                      <input
                        type="number"
                        min="0"
                        value={physicalForm.weight}
                        onChange={(e) => setPhysicalForm({ ...physicalForm, weight: parseInt(e.target.value, 10) || 0 })}
                      />
                    </div>
                    <div className="field">
                      <label className="field__label">Uzunluk (cm)</label>
                      <input
                        type="number"
                        min="0"
                        value={physicalForm.length}
                        onChange={(e) => setPhysicalForm({ ...physicalForm, length: parseInt(e.target.value, 10) || 0 })}
                      />
                    </div>
                    <div className="field">
                      <label className="field__label">Genişlik (cm)</label>
                      <input
                        type="number"
                        min="0"
                        value={physicalForm.width}
                        onChange={(e) => setPhysicalForm({ ...physicalForm, width: parseInt(e.target.value, 10) || 0 })}
                      />
                    </div>
                    <div className="field">
                      <label className="field__label">Yükseklik (cm)</label>
                      <input
                        type="number"
                        min="0"
                        value={physicalForm.height}
                        onChange={(e) => setPhysicalForm({ ...physicalForm, height: parseInt(e.target.value, 10) || 0 })}
                      />
                    </div>
                  </div>

                  <div className="field" style={{ maxWidth: '48%', marginTop: 8 }}>
                    <label className="field__label" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-warning, #f59e0b)', fontWeight: 600 }}>
                      <AlertTriangle size={15} /> Kritik Stok Alarm Eşiği
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={physicalForm.critical_threshold}
                      onChange={(e) => setPhysicalForm({ ...physicalForm, critical_threshold: parseInt(e.target.value, 10) || 0 })}
                    />
                    <span className="muted" style={{ fontSize: '0.75rem', marginTop: 4, display: 'block' }}>
                      Ürünün toplam stoku bu limitin altına indiğinde katalogda ve panellerde görsel uyarı işareti gösterilir.
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-primary)', paddingTop: 14 }}>
                    <button
                      className="btn btn--primary"
                      disabled={updateProductMutation.isPending}
                      onClick={() => updateProductMutation.mutate()}
                    >
                      {updateProductMutation.isPending ? <Spinner size={14} /> : <Save size={15} />} Özellikleri Kaydet
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 3: Gallery Management */}
              {activeTab === 'gallery' && (
                <div className="card animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid var(--border-primary)', paddingBottom: 10 }}>
                    Çoklu Ürün Görselleri (Vitrin Galerisi)
                  </h3>

                  {/* File Upload & URL Addition Zone */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                    {/* Drag and Drop / Select Card */}
                    <div style={{
                      border: '2px dashed var(--border-primary)',
                      borderRadius: 'var(--radius-md)',
                      padding: '24px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      background: 'var(--bg-tertiary)',
                      cursor: 'pointer',
                      position: 'relative',
                      minHeight: 120,
                      transition: 'border-color 0.2s'
                    }}>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          opacity: 0,
                          cursor: 'pointer'
                        }}
                      />
                      {isUploading ? (
                        <>
                          <Spinner size={24} />
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Görseller WebP formatına dönüştürülüyor...
                          </div>
                        </>
                      ) : (
                        <>
                          <Upload size={24} style={{ color: 'var(--text-secondary)' }} />
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              Bilgisayardan Görsel Seç
                            </div>
                            <div className="muted" style={{ fontSize: '0.74rem', marginTop: 4 }}>
                              Birden fazla dosya seçebilirsiniz. Otomatik olarak WebP'ye optimize edilir.
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* URL Input Card */}
                    <div style={{
                      border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-md)',
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      gap: 12,
                      background: 'var(--bg-secondary)'
                    }}>
                      <div className="field" style={{ margin: 0 }}>
                        <label className="field__label" style={{ fontWeight: 600 }}>Görsel URL Adresi ile Ekle</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            type="text"
                            placeholder="https://images.unsplash.com/..."
                            value={newGalleryUrl}
                            onChange={(e) => setNewGalleryUrl(e.target.value)}
                            style={{ flex: 1 }}
                          />
                          <button className="btn btn--primary" onClick={handleAddGalleryImage} style={{ height: 38, whiteSpace: 'nowrap' }}>
                            <Plus size={15} /> URL Ekle
                          </button>
                        </div>
                      </div>
                      <span className="muted" style={{ fontSize: '0.74rem' }}>
                        Alternatif olarak, internetteki hazır görsel linklerini doğrudan yapıştırarak ekleyebilirsiniz.
                      </span>
                    </div>
                  </div>

                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Aktif Galeri Resimleri ({galleryImages.length})</div>
                  {galleryImages.length === 0 ? (
                    <div className="muted" style={{ padding: 20, textAlign: 'center', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                      Galeride hiç detay resmi yok. Ana thumbnail harici resimleri buradan ekleyebilirsiniz.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                      {galleryImages.map((url, idx) => (
                        <div key={idx} className="card" style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
                          <img
                            src={url}
                            alt="Gallery preview"
                            style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                          />
                          <button
                            className="btn btn--danger btn--sm"
                            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                            onClick={() => handleDeleteGalleryImage(idx)}
                          >
                            <Trash2 size={12} /> Kaldır
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-primary)', paddingTop: 14, marginTop: 10 }}>
                    <button
                      className="btn btn--primary"
                      disabled={updateProductMutation.isPending}
                      onClick={() => updateProductMutation.mutate()}
                    >
                      {updateProductMutation.isPending ? <Spinner size={14} /> : <Save size={15} />} Değişiklikleri Kaydet
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 4: Pricing & Variants Matrix */}
              {activeTab === 'variants' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {variants.map((v) => {
                    const draft = getVariantDraft(v)
                    const saving = saveVariantMutation.isPending && saveVariantMutation.variables?.id === v.id
                    return (
                      <div key={v.id} className="card animate-fadeIn">
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', borderBottom: '1px solid var(--border-primary)', paddingBottom: 10, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                          <span>{v.title || 'Standart Varyant'}</span>
                          <span className="muted" style={{ fontSize: '0.75rem' }}>ID: {v.id}</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                          <div className="field">
                            <label className="field__label">Fiyat (TRY)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={draft.price}
                              onChange={(e) => setVariantDraft(v.id, { price: e.target.value })}
                            />
                          </div>
                          <div className="field">
                            <label className="field__label">Envanter (Stok)</label>
                            <input
                              type="number"
                              value={v.manage_inventory ? draft.stock : ''}
                              disabled={!v.manage_inventory}
                              placeholder={v.manage_inventory ? '' : 'Sınırsız'}
                              onChange={(e) => setVariantDraft(v.id, { stock: e.target.value })}
                            />
                          </div>
                          <div className="field">
                            <label className="field__label">Stok Kodu (SKU)</label>
                            <input
                              type="text"
                              value={draft.sku}
                              onChange={(e) => setVariantDraft(v.id, { sku: e.target.value })}
                            />
                          </div>
                          <div className="field">
                            <label className="field__label">Barkod (EAN/UPC)</label>
                            <input
                              type="text"
                              value={draft.barcode}
                              onChange={(e) => setVariantDraft(v.id, { barcode: e.target.value })}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-primary)', paddingTop: 14 }}>
                          <button
                            className="btn btn--primary"
                            disabled={saving}
                            onClick={() => saveVariantMutation.mutate(v)}
                          >
                            {saving ? <Spinner size={14} /> : <Barcode size={15} />} Değerleri Kaydet
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Tab 5: Showcase & Video Presentation */}
              {activeTab === 'showcase' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="animate-fadeIn">
                  
                  {/* General Showcase Info */}
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid var(--border-primary)', paddingBottom: 10 }}>
                      Multimedya ve Vitrin Tanıtımı
                    </h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div className="field">
                        <label className="field__label">Slogan (Tagline)</label>
                        <input
                          type="text"
                          placeholder="Örn: 72 SAAT BOYUNCA YAŞAM DESTEĞİ"
                          value={showcaseForm.tagline}
                          onChange={(e) => setShowcaseForm({ ...showcaseForm, tagline: e.target.value })}
                        />
                      </div>
                      <div className="field">
                        <label className="field__label">Kullanım Videosu Embed URL (YouTube)</label>
                        <input
                          type="text"
                          placeholder="https://www.youtube.com/embed/Yt7aUepwF4w"
                          value={showcaseForm.video_url}
                          onChange={(e) => setShowcaseForm({ ...showcaseForm, video_url: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Showcase Features list */}
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid var(--border-primary)', paddingBottom: 10 }}>
                      İkonlu Özellik Maddeleri (Showcase Features)
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '0.6fr 1.4fr 1.5fr 0.5fr', gap: 10, alignItems: 'flex-end' }}>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label className="field__label">İkon Tipi</label>
                        <select
                          value={newFeature.iconName}
                          onChange={(e) => setNewFeature({ ...newFeature, iconName: e.target.value })}
                        >
                          <option value="Shield">Kalkan (Shield)</option>
                          <option value="Activity">Medikal (Activity)</option>
                          <option value="Flame">Ateş/Termal (Flame)</option>
                          <option value="BatteryCharging">Pil/Enerji (Battery)</option>
                          <option value="Sun">Güneş (Sun)</option>
                          <option value="Droplets">Su/Sıvı (Droplets)</option>
                        </select>
                      </div>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label className="field__label">Özellik Başlığı</label>
                        <input
                          type="text"
                          placeholder="Askeri Çanta"
                          value={newFeature.title}
                          onChange={(e) => setNewFeature({ ...newFeature, title: e.target.value })}
                        />
                      </div>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label className="field__label">Kısa Açıklama</label>
                        <input
                          type="text"
                          placeholder="Su geçirmez Oxford Cordura naylon kumaş"
                          value={newFeature.desc}
                          onChange={(e) => setNewFeature({ ...newFeature, desc: e.target.value })}
                        />
                      </div>
                      <button className="btn btn--primary" onClick={handleAddFeature} style={{ height: 38 }}>
                        <Plus size={15} /> Ekle
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                      {showcaseFeatures.map((feat, idx) => (
                        <div key={idx} className="card" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)' }}>
                          <div>
                            <strong>[{feat.iconName}] {feat.title}</strong>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>{feat.desc}</p>
                          </div>
                          <button className="btn btn--ghost btn--icon text-danger" onClick={() => handleDeleteFeature(idx)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Technical specs table */}
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid var(--border-primary)', paddingBottom: 10 }}>
                      Teknik Detay Tablosu (Key-Value)
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.4fr', gap: 10, alignItems: 'flex-end' }}>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label className="field__label">Özellik Adı (Label)</label>
                        <input
                          type="text"
                          placeholder="Örn: Kişi Kapasitesi"
                          value={newSpec.label}
                          onChange={(e) => setNewSpec({ ...newSpec, label: e.target.value })}
                        />
                      </div>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label className="field__label">Değeri (Value)</label>
                        <input
                          type="text"
                          placeholder="Örn: 4 Kişilik"
                          value={newSpec.value}
                          onChange={(e) => setNewSpec({ ...newSpec, value: e.target.value })}
                        />
                      </div>
                      <button className="btn btn--primary" onClick={handleAddSpec} style={{ height: 38 }}>
                        <Plus size={15} /> Ekle
                      </button>
                    </div>

                    <div className="table-container" style={{ marginTop: 10 }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Özellik</th>
                            <th>Değer</th>
                            <th style={{ textAlign: 'right' }}>İşlem</th>
                          </tr>
                        </thead>
                        <tbody>
                          {showcaseSpecs.map((spec, idx) => (
                            <tr key={idx}>
                              <td><strong>{spec.label}</strong></td>
                              <td>{spec.value}</td>
                              <td style={{ textAlign: 'right' }}>
                                <button className="btn btn--ghost btn--icon text-danger" onClick={() => handleDeleteSpec(idx)}>
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Highlight slides with large images */}
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid var(--border-primary)', paddingBottom: 10 }}>
                      Detaylı Tanıtım Slaytları (Highlights)
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr 0.4fr', gap: 10, alignItems: 'flex-end' }}>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label className="field__label">Başlık</label>
                        <input
                          type="text"
                          placeholder="Örn: Acil Gıdalar"
                          value={newHighlight.title}
                          onChange={(e) => setNewHighlight({ ...newHighlight, title: e.target.value })}
                        />
                      </div>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label className="field__label">Geniş Açıklama</label>
                        <input
                          type="text"
                          placeholder="TÜBİTAK onaylı uzun ömürlü yiyecekler"
                          value={newHighlight.desc}
                          onChange={(e) => setNewHighlight({ ...newHighlight, desc: e.target.value })}
                        />
                      </div>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label className="field__label">Görsel URL</label>
                        <input
                          type="text"
                          placeholder="https://images.unsplash.com/..."
                          value={newHighlight.image}
                          onChange={(e) => setNewHighlight({ ...newHighlight, image: e.target.value })}
                        />
                      </div>
                      <button className="btn btn--primary" onClick={handleAddHighlight} style={{ height: 38 }}>
                        <Plus size={15} /> Ekle
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                      {showcaseHighlights.map((hl, idx) => (
                        <div key={idx} className="card" style={{ padding: 12, display: 'flex', gap: 12, background: 'var(--bg-tertiary)' }}>
                          <img src={hl.image} alt={hl.title} style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                          <div style={{ flex: 1 }}>
                            <strong>{hl.title}</strong>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>{hl.desc}</p>
                          </div>
                          <button className="btn btn--ghost btn--icon text-danger" onClick={() => handleDeleteHighlight(idx)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Global Save Button for Showcase & Details */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-primary)', paddingTop: 14 }}>
                    <button
                      className="btn btn--primary"
                      disabled={updateProductMutation.isPending}
                      onClick={() => updateProductMutation.mutate()}
                    >
                      {updateProductMutation.isPending ? <Spinner size={14} /> : <Save size={15} />} Tüm Showcase Bilgilerini Kaydet
                    </button>
                  </div>

                </div>
              )}

            </div>

            {/* Right Column: Live Card Preview & Quick Specs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              {/* Live Preview Card */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h4 style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                  <Eye size={15} /> Vitrin Kart Önizleme
                </h4>
                {generalForm.thumbnail ? (
                  <img
                    src={generalForm.thumbnail}
                    alt={generalForm.title}
                    style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-primary)' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: 160, background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)' }}>
                    Görsel yok
                  </div>
                )}
                <div>
                  {showcaseForm.tagline && (
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--accent-danger)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 2 }}>
                      {showcaseForm.tagline}
                    </span>
                  )}
                  <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 6, color: 'var(--text-primary)' }}>
                    {generalForm.title || 'İsimsiz Ürün'}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {generalForm.description || 'Açıklama girilmemiş.'}
                  </p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Badge status={productStatus(generalForm.status)} />
                    {physicalForm.weight > 0 && (
                      <span className="badge badge--info">{physicalForm.weight} gr</span>
                    )}
                    {physicalForm.material && (
                      <span className="badge badge--neutral" style={{ fontSize: '0.74rem' }}>{physicalForm.material}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* System Info & Logistics Specs */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h4 style={{ fontWeight: 700, fontSize: '0.9rem', borderBottom: '1px solid var(--border-primary)', paddingBottom: 8 }}>
                  Sistem & Boyut Bilgisi
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', fontSize: '0.82rem', justifyContent: 'space-between' }}>
                    <span className="muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={13} /> Kayıt Tarihi</span>
                    <strong>{formattedDate}</strong>
                  </div>
                  
                  <div style={{ display: 'flex', fontSize: '0.82rem', justifyContent: 'space-between' }}>
                    <span className="muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Layers size={13} /> Varyantlar</span>
                    <strong>{variants.length} Varyant</strong>
                  </div>

                  <div style={{ display: 'flex', fontSize: '0.82rem', justifyContent: 'space-between' }}>
                    <span className="muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Compass size={13} /> Boyutlar (ExBxY)</span>
                    <strong>
                      {physicalForm.length && physicalForm.width && physicalForm.height
                        ? `${physicalForm.length} x ${physicalForm.width} x ${physicalForm.height} cm`
                        : 'Belirtilmemiş'}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', fontSize: '0.82rem', justifyContent: 'space-between' }}>
                    <span className="muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Globe size={13} /> Menşei Ülke</span>
                    <strong>{physicalForm.origin_country || 'Belirtilmemiş'}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
