import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Warehouse, AlertTriangle, Search, CheckCircle, TrendingUp, Save } from 'lucide-react'
import Header from '../../components/layout/Header'
import { LoadingState } from '../../components/ui/Spinner'
import { ErrorState, EmptyState } from '../../components/ui/StateBox'
import { useToast } from '../../components/ui/toast-context'
import { useDebounce } from '../../lib/useDebounce'
import { api } from '../../lib/api'
import './WarehouseInventory.css'

interface StockLocation {
  id: string
  name: string
}

interface LevelInfo {
  location_id: string
  stocked_quantity: number
  reserved_quantity: number
}

// Düzleştirilmiş envanter satırı (varyant bazlı — envanter Medusa'da varyant/inventory-item başına tutulur)
interface InvRow {
  key: string
  productId: string
  productTitle: string
  variantTitle: string
  sku: string
  inventoryItemId: string | null
  threshold: number
  levels: Record<string, LevelInfo> // location_id -> level
  total: number // available = stocked - reserved (tüm lokasyonlar)
}

const PRODUCT_FIELDS =
  'id,title,metadata,' +
  'variants.id,variants.title,variants.sku,variants.manage_inventory,' +
  'variants.inventory_items.inventory_item_id,' +
  'variants.inventory_items.inventory.location_levels.location_id,' +
  'variants.inventory_items.inventory.location_levels.stocked_quantity,' +
  'variants.inventory_items.inventory.location_levels.reserved_quantity'

export default function WarehouseInventory() {
  const { notify } = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search)
  // Hücre düzenleme tamponu: `${invItemId}:${locId}` -> stringvalue
  const [edits, setEdits] = useState<Record<string, string>>({})

  const { data: locResp } = useQuery({
    queryKey: ['stock-locations'],
    queryFn: () => api.get<{ stock_locations: StockLocation[] }>('/admin/stock-locations', { fields: 'id,name', limit: 50 }),
  })
  const locations = useMemo(() => locResp?.stock_locations ?? [], [locResp])

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['inventory-products'],
    queryFn: () => api.get<{ products: any[] }>('/admin/products', { fields: PRODUCT_FIELDS, limit: 200 }),
  })

  const rows = useMemo<InvRow[]>(() => {
    const out: InvRow[] = []
    for (const p of data?.products ?? []) {
      const threshold = Number(p.metadata?.critical_threshold) || 10
      for (const v of p.variants ?? []) {
        if (!v.manage_inventory) continue
        const ii = (v.inventory_items ?? [])[0]
        const invItemId = ii?.inventory_item_id ?? null
        const levels: Record<string, LevelInfo> = {}
        let total = 0
        for (const lvl of ii?.inventory?.location_levels ?? []) {
          const info: LevelInfo = {
            location_id: lvl.location_id,
            stocked_quantity: lvl.stocked_quantity ?? 0,
            reserved_quantity: lvl.reserved_quantity ?? 0,
          }
          levels[lvl.location_id] = info
          total += info.stocked_quantity - info.reserved_quantity
        }
        out.push({
          key: v.id,
          productId: p.id,
          productTitle: p.title,
          variantTitle: v.title || '',
          sku: v.sku || '—',
          inventoryItemId: invItemId,
          threshold,
          levels,
          total,
        })
      }
    }
    return out
  }, [data])

  const filtered = useMemo(() => {
    const q = debounced.toLowerCase().trim()
    if (!q) return rows
    return rows.filter(
      (r) => r.productTitle.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q) || r.variantTitle.toLowerCase().includes(q)
    )
  }, [rows, debounced])

  const saveLevel = useMutation({
    mutationFn: async (args: { invItemId: string; locationId: string; stocked: number; exists: boolean }) => {
      const { invItemId, locationId, stocked, exists } = args
      if (exists) {
        // Var olan seviyeyi güncelle
        return api.post(`/admin/inventory-items/${invItemId}/location-levels/${locationId}`, {
          stocked_quantity: stocked,
        })
      }
      // Yoksa oluştur
      return api.post(`/admin/inventory-items/${invItemId}/location-levels`, {
        location_id: locationId,
        stocked_quantity: stocked,
      })
    },
    onSuccess: () => {
      notify('Stok güncellendi.')
      qc.invalidateQueries({ queryKey: ['inventory-products'] })
      qc.invalidateQueries({ queryKey: ['products-dashboard'] })
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const cellKey = (invItemId: string, locId: string) => `${invItemId}:${locId}`

  const commitCell = (row: InvRow, locId: string) => {
    if (!row.inventoryItemId) return
    const k = cellKey(row.inventoryItemId, locId)
    const raw = edits[k]
    if (raw === undefined) return
    const stocked = parseInt(raw, 10)
    const current = row.levels[locId]?.stocked_quantity ?? 0
    if (Number.isNaN(stocked) || stocked < 0 || stocked === current) {
      setEdits((p) => { const n = { ...p }; delete n[k]; return n })
      return
    }
    saveLevel.mutate(
      { invItemId: row.inventoryItemId, locationId: locId, stocked, exists: !!row.levels[locId] },
      { onSettled: () => setEdits((p) => { const n = { ...p }; delete n[k]; return n }) }
    )
  }

  const totalUnits = rows.reduce((s, r) => s + r.total, 0)
  const critical = rows.filter((r) => r.total <= r.threshold)

  return (
    <>
      <Header title="Depo & Envanter" subtitle="Lokasyon bazlı stok seviyelerini görüntüle ve güncelle" />
      <div className="inventory-page animate-fadeIn">
        {/* Summary */}
        <div className="inventory-stats">
          <div className="inventory-stat-card">
            <div className="inventory-stat-card__icon bg-primary-light text-primary"><Warehouse size={20} /></div>
            <div className="inventory-stat-card__content">
              <span className="inventory-stat-card__label">Stok Lokasyonu</span>
              <span className="inventory-stat-card__value">{locations.length} Konum</span>
            </div>
          </div>
          <div className="inventory-stat-card">
            <div className="inventory-stat-card__icon bg-success-light text-success"><TrendingUp size={20} /></div>
            <div className="inventory-stat-card__content">
              <span className="inventory-stat-card__label">Toplam Kullanılabilir Adet</span>
              <span className="inventory-stat-card__value">{totalUnits.toLocaleString('tr-TR')} Adet</span>
            </div>
          </div>
          <div className="inventory-stat-card">
            <div className="inventory-stat-card__icon bg-danger-light text-danger"><AlertTriangle size={20} /></div>
            <div className="inventory-stat-card__content">
              <span className="inventory-stat-card__label">Kritik Stok</span>
              <span className="inventory-stat-card__value text-danger">{critical.length} Varyant</span>
            </div>
          </div>
        </div>

        {/* Matrix */}
        <div className="inventory-matrix-section">
          <div className="card matrix-card">
            <div className="matrix-card__header">
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Lokasyon Bazlı Stok</h3>
                <p className="subtitle">Hücreye yeni adet yazıp Enter'a basın veya alandan çıkın — anında kaydedilir.</p>
              </div>
              <div className="header__search" style={{ width: 260 }}>
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Ürün, varyant veya SKU ara..."
                  className="header__search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {isLoading ? (
              <LoadingState label="Envanter yükleniyor..." />
            ) : isError ? (
              <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
            ) : filtered.length === 0 ? (
              <EmptyState icon={<Warehouse size={26} />} title="Stok takipli ürün bulunamadı" description="Arama kriterine uygun, envanteri yönetilen ürün yok." />
            ) : (
              <div className="table-container" style={{ opacity: isFetching ? 0.7 : 1 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Ürün / Varyant</th>
                      <th style={{ textAlign: 'center' }}>Toplam</th>
                      {locations.map((loc) => (
                        <th key={loc.id} style={{ textAlign: 'center' }}>{loc.name}</th>
                      ))}
                      <th style={{ textAlign: 'center' }}>Eşik</th>
                      <th>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const isLow = r.total <= r.threshold
                      return (
                        <tr key={r.key} className={isLow ? 'row--critical' : ''}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{r.productTitle}</div>
                            <div className="muted" style={{ fontSize: '0.74rem' }}>
                              {r.variantTitle && `${r.variantTitle} • `}{r.sku}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <strong className={isLow ? 'text-danger' : 'text-success'}>{r.total}</strong>
                          </td>
                          {locations.map((loc) => {
                            const lvl = r.levels[loc.id]
                            const k = r.inventoryItemId ? cellKey(r.inventoryItemId, loc.id) : ''
                            const editing = edits[k]
                            const val = editing !== undefined ? editing : String(lvl?.stocked_quantity ?? 0)
                            const reserved = lvl?.reserved_quantity ?? 0
                            return (
                              <td key={loc.id} style={{ width: 120, textAlign: 'center' }}>
                                {r.inventoryItemId ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                                    <input
                                      type="number"
                                      min={0}
                                      className="matrix-stock-input"
                                      value={val}
                                      disabled={saveLevel.isPending}
                                      onChange={(e) => setEdits((p) => ({ ...p, [k]: e.target.value }))}
                                      onBlur={() => commitCell(r, loc.id)}
                                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                    />
                                    {editing !== undefined && <Save size={13} className="text-warning" />}
                                  </div>
                                ) : (
                                  <span className="muted">—</span>
                                )}
                                {reserved > 0 && (
                                  <div className="muted" style={{ fontSize: '0.68rem' }}>{reserved} rezerve</div>
                                )}
                              </td>
                            )
                          })}
                          <td style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>{r.threshold}</td>
                          <td>
                            <span className={`badge ${isLow ? 'badge--danger' : 'badge--success'}`}>
                              {isLow ? 'Kritik Stok' : 'Güvenli'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Critical stock list */}
        <div className="inventory-bottom-grid">
          <div className="card planner-card">
            <div className="planner-card__header">
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={16} className="text-warning" /> Tedarik Önerileri
                </h3>
                <p className="subtitle">Eşik değerin altındaki varyantlar</p>
              </div>
            </div>
            <div className="planner-list">
              {critical.length === 0 ? (
                <div className="planner-empty">
                  <CheckCircle size={28} className="text-success" />
                  <p>Tüm stoklar güvenli seviyede. Ek tedarik gerekmiyor.</p>
                </div>
              ) : (
                critical.map((r) => {
                  const suggested = Math.max(r.threshold * 2 - r.total, 0)
                  return (
                    <div key={r.key} className="planner-item">
                      <div className="planner-item__info">
                        <span className="planner-item__name">{r.productTitle}{r.variantTitle ? ` — ${r.variantTitle}` : ''}</span>
                        <div className="planner-item__details">
                          <span className="badge badge--danger-light text-danger">Mevcut: {r.total}</span>
                          <span className="muted">Eşik: {r.threshold}</span>
                        </div>
                      </div>
                      <div className="planner-item__action">
                        <div className="planner-item__suggestion">Önerilen tamamlama: +{suggested} adet</div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
