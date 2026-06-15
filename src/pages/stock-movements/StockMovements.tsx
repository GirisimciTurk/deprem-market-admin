import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { History, Search } from 'lucide-react'
import Header from '../../components/layout/Header'
import Pagination from '../../components/ui/Pagination'
import { LoadingState } from '../../components/ui/Spinner'
import { EmptyState, ErrorState } from '../../components/ui/StateBox'
import { useDebounce } from '../../lib/useDebounce'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'

const LIMIT = 25

interface Movement {
  id: string
  inventory_item_id: string
  location_id: string
  sku?: string | null
  product_title?: string | null
  location_name?: string | null
  type: string
  quantity_delta: number
  resulting_quantity?: number | null
  reason?: string | null
  reference_id?: string | null
  actor?: string | null
  created_at: string
}

interface Resp {
  movements: Movement[]
  count: number
  offset: number
  limit: number
}

const TYPE_META: Record<string, { label: string; color: string }> = {
  sale: { label: 'Satış', color: '#dc2626' },
  return: { label: 'İade', color: '#16a34a' },
  manual: { label: 'Manuel', color: '#F08C1A' },
  transfer_in: { label: 'Transfer (Giriş)', color: '#0891b2' },
  transfer_out: { label: 'Transfer (Çıkış)', color: '#d97706' },
  count: { label: 'Sayım', color: '#7c3aed' },
  initial: { label: 'Kurulum', color: '#64748b' },
}

const TYPE_OPTIONS = [
  { value: '', label: 'Tüm türler' },
  ...Object.entries(TYPE_META).map(([value, m]) => ({ value, label: m.label })),
]

export default function StockMovements() {
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const debounced = useDebounce(search)

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['stock-movements', offset, debounced, type],
    queryFn: () =>
      api.get<Resp>('/admin/stock-movements', {
        limit: LIMIT,
        offset,
        q: debounced || undefined,
        type: type || undefined,
      }),
    placeholderData: keepPreviousData,
  })

  const movements = data?.movements ?? []

  return (
    <>
      <Header title="Stok Geçmişi" subtitle="Tüm stok hareketleri: satış, iade, manuel düzeltme, transfer ve sayım" />
      <div style={{ padding: 24 }}>
        <div className="card" style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="header__search" style={{ width: 280 }}>
            <Search size={14} />
            <input
              type="text"
              placeholder="Ürün adı veya SKU ara..."
              className="header__search-input"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOffset(0) }}
            />
          </div>
          <select value={type} onChange={(e) => { setType(e.target.value); setOffset(0) }} style={{ minWidth: 160 }}>
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {isLoading ? (
          <LoadingState label="Hareketler yükleniyor..." />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : movements.length === 0 ? (
          <EmptyState
            icon={<History size={26} />}
            title="Stok hareketi yok"
            description="Henüz kayıtlı stok hareketi yok. Satış, iade, manuel düzeltme, transfer ve sayımlar burada listelenir."
          />
        ) : (
          <>
            <div className="table-container" style={{ opacity: isFetching ? 0.6 : 1, transition: 'opacity 0.15s' }}>
              <table>
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Tür</th>
                    <th>Ürün / SKU</th>
                    <th>Lokasyon</th>
                    <th style={{ textAlign: 'center' }}>Değişim</th>
                    <th style={{ textAlign: 'center' }}>Sonraki</th>
                    <th>Açıklama</th>
                    <th>Yapan</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => {
                    const meta = TYPE_META[m.type] ?? { label: m.type, color: '#64748b' }
                    const up = m.quantity_delta > 0
                    return (
                      <tr key={m.id}>
                        <td className="nowrap muted" style={{ fontSize: '0.8rem' }}>{formatDate(m.created_at)}</td>
                        <td>
                          <span className="badge" style={{ background: `${meta.color}22`, color: meta.color, fontWeight: 600 }}>
                            {meta.label}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.875rem' }}>{m.product_title ?? '—'}</div>
                          <div className="muted" style={{ fontSize: '0.74rem' }}>{m.sku ?? m.inventory_item_id}</div>
                        </td>
                        <td className="muted" style={{ fontSize: '0.82rem' }}>{m.location_name ?? '—'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: up ? 'var(--success,#16a34a)' : 'var(--danger,#dc2626)' }}>
                          {up ? '+' : ''}{m.quantity_delta}
                        </td>
                        <td style={{ textAlign: 'center' }}>{m.resulting_quantity ?? '—'}</td>
                        <td className="muted" style={{ fontSize: '0.8rem', maxWidth: 240 }}>{m.reason ?? '—'}</td>
                        <td className="muted" style={{ fontSize: '0.78rem' }}>{m.actor ?? 'sistem'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination offset={offset} limit={LIMIT} count={data?.count ?? 0} onChange={setOffset} />
          </>
        )}
      </div>
    </>
  )
}
