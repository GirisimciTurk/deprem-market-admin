import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Users, Search, Eye, Calendar, Mail } from 'lucide-react'
import Header from '../../components/layout/Header'
import Pagination from '../../components/ui/Pagination'
import { LoadingState } from '../../components/ui/Spinner'
import { EmptyState, ErrorState } from '../../components/ui/StateBox'
import { useDebounce } from '../../lib/useDebounce'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'
import type { Customer } from '../../lib/types'
import CustomerDetail from './CustomerDetail'

const LIMIT = 20

interface CustomersResponse {
  customers: Customer[]
  count: number
  offset: number
  limit: number
}

export default function Customers() {
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const debouncedSearch = useDebounce(search)

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<CustomersResponse>({
    queryKey: ['customers', offset, debouncedSearch],
    queryFn: () =>
      api.get<CustomersResponse>('/admin/customers', {
        limit: LIMIT,
        offset,
        q: debouncedSearch || undefined,
      }),
    placeholderData: keepPreviousData,
  })

  const customers = data?.customers ?? []

  return (
    <>
      <Header title="Müşteriler" subtitle="Müşteri profillerini ve sipariş geçmişlerini yönetin" />

      <div style={{ padding: '24px' }}>
        {/* Search Toolbar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <div className="header__search" style={{ flex: 1 }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Müşteri adı veya e-postası ile ara..."
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
          <LoadingState label="Müşteriler yükleniyor..." />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : customers.length === 0 ? (
          <EmptyState
            icon={<Users size={26} />}
            title="Müşteri bulunamadı"
            description={debouncedSearch ? 'Aramanıza uygun müşteri bulunmamaktadır.' : 'Kayıtlı müşteri bulunmamaktadır.'}
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
                    <th>Müşteri</th>
                    <th>E-posta</th>
                    <th>Telefon</th>
                    <th>Katılım Tarihi</th>
                    <th style={{ textAlign: 'right' }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              background: 'var(--bg-tertiary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--text-secondary)',
                              fontWeight: 600,
                              fontSize: '0.85rem',
                            }}
                          >
                            {(c.first_name?.[0] ?? c.email[0]).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500 }}>
                              {c.first_name || c.last_name
                                ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()
                                : 'İsimsiz Müşteri'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Mail size={14} className="muted" />
                          <span>{c.email}</span>
                        </div>
                      </td>
                      <td className="muted">{c.phone || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }} className="muted">
                          <Calendar size={14} />
                          <span>{c.created_at ? formatDate(c.created_at) : '—'}</span>
                        </div>
                      </td>
                      <td>
                        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn--secondary btn--sm"
                            onClick={() => setSelectedCustomer(c)}
                          >
                            <Eye size={14} /> Detay
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

      {selectedCustomer && (
        <CustomerDetail customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      )}
    </>
  )
}
