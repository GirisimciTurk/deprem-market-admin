import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import { Spinner, LoadingState } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/StateBox'
import { useToast } from '../../components/ui/toast-context'
import { api } from '../../lib/api'
import { toMajor, toMinor } from '../../lib/format'
import type { MoneyAmount } from '../../lib/types'

interface Props {
  productId: string
  title: string
  onClose: () => void
}

// Loose inventory linkage shapes (only the fields we read).
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
  manage_inventory?: boolean
  prices?: MoneyAmount[]
  inventory_items?: InvLink[]
}
interface DetailResponse {
  product: { id: string; title: string; variants?: DetailVariant[] }
}

const DETAIL_FIELDS =
  'id,title,*variants,*variants.manage_inventory,*variants.prices,*variants.inventory_items,*variants.inventory_items.inventory,*variants.inventory_items.inventory.location_levels'

function tryPriceAmount(prices?: MoneyAmount[]): number | undefined {
  return prices?.find((p) => p.currency_code?.toLowerCase() === 'try')?.amount ?? prices?.[0]?.amount
}

function firstLevel(variant: DetailVariant): { inventoryItemId?: string; level?: InvLevel } {
  const link = variant.inventory_items?.[0]
  const inventoryItemId = link?.inventory_item_id ?? link?.inventory?.id
  const level = link?.inventory?.location_levels?.[0]
  return { inventoryItemId, level }
}

export default function ProductEdit({ productId, title, onClose }: Props) {
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const [drafts, setDrafts] = useState<Record<string, { price: string; stock: string }>>({})

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => api.get<DetailResponse>(`/admin/products/${productId}`, { fields: DETAIL_FIELDS }),
  })

  const variants = useMemo(() => data?.product?.variants ?? [], [data])

  const getDraft = (v: DetailVariant) => {
    const existing = drafts[v.id]
    if (existing) return existing
    const price = tryPriceAmount(v.prices)
    const { level } = firstLevel(v)
    return {
      price: price !== undefined ? String(toMajor(price)) : '',
      stock: level ? String(level.stocked_quantity) : '',
    }
  }

  const setDraft = (id: string, patch: Partial<{ price: string; stock: string }>) => {
    setDrafts((d) => ({ ...d, [id]: { ...getDraft(variants.find((v) => v.id === id)!), ...d[id], ...patch } }))
  }

  const saveMutation = useMutation({
    mutationFn: async (variant: DetailVariant) => {
      const draft = getDraft(variant)
      const newPrice = parseFloat(draft.price)
      const newStock = parseInt(draft.stock, 10)

      // 1) Update price (preserve non-TRY prices, replace/insert the TRY one).
      // Amounts are stored in minor units, so convert the entered value back.
      if (!Number.isNaN(newPrice)) {
        const others = (variant.prices ?? []).filter((p) => p.currency_code?.toLowerCase() !== 'try')
        const prices = [
          ...others.map((p) => ({ amount: p.amount, currency_code: p.currency_code })),
          { amount: toMinor(newPrice), currency_code: 'try' },
        ]
        await api.post(`/admin/products/${productId}/variants/${variant.id}`, { prices })
      }

      // 2) Update stock via inventory location level — only when this variant
      // actually tracks inventory and has a linked location level.
      if (variant.manage_inventory && !Number.isNaN(newStock)) {
        const { inventoryItemId, level } = firstLevel(variant)
        if (inventoryItemId && level?.location_id) {
          await api.post(`/admin/inventory-items/${inventoryItemId}/location-levels/${level.location_id}`, {
            stocked_quantity: newStock,
          })
        } else {
          throw new Error('Bu varyant için envanter konumu bulunamadı; stok güncellenemedi (fiyat kaydedildi).')
        }
      }
    },
    onSuccess: () => {
      notify('Varyant güncellendi.')
      queryClient.invalidateQueries({ queryKey: ['product', productId] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  return (
    <Modal title={`Düzenle — ${title}`} size="lg" onClose={onClose}>
      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {variants.map((v) => {
            const draft = getDraft(v)
            const saving = saveMutation.isPending && saveMutation.variables?.id === v.id
            return (
              <div key={v.id} className="card">
                <div style={{ fontWeight: 600, marginBottom: 12 }}>
                  {v.title || 'Varyant'}
                  {v.sku && <span className="muted" style={{ marginLeft: 8, fontSize: '0.78rem' }}>SKU: {v.sku}</span>}
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
                    <label className="field__label">Fiyat (TRY)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={draft.price}
                      onChange={(e) => setDraft(v.id, { price: e.target.value })}
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 120 }}>
                    <label className="field__label">Stok</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={v.manage_inventory ? draft.stock : ''}
                      disabled={!v.manage_inventory}
                      placeholder={v.manage_inventory ? '' : 'Takip kapalı'}
                      onChange={(e) => setDraft(v.id, { stock: e.target.value })}
                    />
                    {!v.manage_inventory && (
                      <div className="field__error" style={{ color: 'var(--text-tertiary)' }}>
                        Bu üründe stok takibi kapalı.
                      </div>
                    )}
                  </div>
                  <button
                    className="btn btn--primary"
                    disabled={saving}
                    onClick={() => saveMutation.mutate(v)}
                  >
                    {saving ? <Spinner size={14} /> : <Save size={15} />} Kaydet
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
