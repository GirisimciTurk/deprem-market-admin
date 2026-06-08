import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Package, Search, Pencil } from 'lucide-react'
import Header from '../../components/layout/Header'
import Badge from '../../components/ui/Badge'
import Pagination from '../../components/ui/Pagination'
import { LoadingState } from '../../components/ui/Spinner'
import { EmptyState, ErrorState } from '../../components/ui/StateBox'
import { useDebounce } from '../../lib/useDebounce'
import { api } from '../../lib/api'
import type { Product, ProductVariant } from '../../lib/types'
import { productStatus } from '../../lib/statusLabels'
import { formatMoney } from '../../lib/format'
import ProductEdit from './ProductEdit'

const LIMIT = 20
const PRODUCT_FIELDS =
  'id,title,handle,status,thumbnail,created_at,*variants,*variants.prices,variants.inventory_quantity,variants.manage_inventory'

interface ProductsResponse {
  products: Product[]
  count: number
  offset: number
  limit: number
}

function tryPrice(variant: ProductVariant): number | undefined {
  const price = variant.prices?.find((p) => p.currency_code?.toLowerCase() === 'try')
  return price?.amount ?? variant.prices?.[0]?.amount
}

function priceRange(product: Product): string {
  const amounts = (product.variants ?? [])
    .map((v) => tryPrice(v))
    .filter((a): a is number => typeof a === 'number')
  if (amounts.length === 0) return '-'
  const min = Math.min(...amounts)
  const max = Math.max(...amounts)
  return min === max ? formatMoney(min) : `${formatMoney(min)} – ${formatMoney(max)}`
}

// Returns total tracked stock, or null when no variant manages inventory.
function totalStock(product: Product): number | null {
  const tracked = (product.variants ?? []).filter((v) => v.manage_inventory)
  if (tracked.length === 0) return null
  return tracked.reduce((sum, v) => sum + (v.inventory_quantity ?? 0), 0)
}

export default function Products() {
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Product | null>(null)
  const debouncedSearch = useDebounce(search)

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['products', offset, debouncedSearch],
    queryFn: () =>
      api.get<ProductsResponse>('/admin/products', {
        limit: LIMIT,
        offset,
        fields: PRODUCT_FIELDS,
        q: debouncedSearch || undefined,
      }),
    placeholderData: keepPreviousData,
  })

  const products = data?.products ?? []

  return (
    <>
      <Header title="Ürünler" subtitle="Ürün kataloğunu, fiyat ve stokları yönet" />
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <div className="header__search" style={{ flex: 1 }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Ürün ara..."
              className="header__search-input"
              style={{ width: '100%' }}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setOffset(0)
              }}
            />
          </div>
        </div>

        {isLoading ? (
          <LoadingState label="Ürünler yükleniyor..." />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : products.length === 0 ? (
          <EmptyState
            icon={<Package size={26} />}
            title="Ürün bulunamadı"
            description={debouncedSearch ? 'Aramanıza uygun ürün yok.' : 'Henüz ürün eklenmemiş.'}
          />
        ) : (
          <>
            <div
              className="table-container"
              style={{ opacity: isFetching ? 0.6 : 1, transition: 'opacity 0.15s' }}
            >
              <table>
                <thead>
                  <tr>
                    <th>Ürün</th>
                    <th>Durum</th>
                    <th>Varyant</th>
                    <th>Fiyat</th>
                    <th>Stok</th>
                    <th style={{ textAlign: 'right' }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {p.thumbnail ? (
                            <img
                              src={p.thumbnail}
                              alt={p.title}
                              style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', objectFit: 'cover', border: '1px solid var(--border-primary)' }}
                            />
                          ) : (
                            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Package size={16} style={{ color: 'var(--text-tertiary)' }} />
                            </div>
                          )}
                          <div>
                            <div>{p.title}</div>
                            <div className="muted" style={{ fontSize: '0.76rem' }}>{p.handle}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge status={productStatus(p.status)} />
                      </td>
                      <td className="muted">{p.variants?.length ?? 0}</td>
                      <td className="nowrap">{priceRange(p)}</td>
                      <td>
                        {totalStock(p) === null ? (
                          <span className="muted" title="Stok takibi kapalı">—</span>
                        ) : (
                          totalStock(p)
                        )}
                      </td>
                      <td>
                        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn btn--secondary btn--sm" onClick={() => setEditing(p)}>
                            <Pencil size={14} /> Düzenle
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination offset={offset} limit={LIMIT} count={data?.count ?? 0} onChange={setOffset} />
          </>
        )}
      </div>

      {editing && <ProductEdit productId={editing.id} title={editing.title} onClose={() => setEditing(null)} />}
    </>
  )
}
