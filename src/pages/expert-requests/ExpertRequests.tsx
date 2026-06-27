import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  Inbox,
  Search,
  Eye,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Trash2,
  User,
  MessageSquare,
} from 'lucide-react'
import Header from '../../components/layout/Header'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import Pagination from '../../components/ui/Pagination'
import { LoadingState } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/StateBox'
import { useToast } from '../../components/ui/toast-context'
import { useDebounce } from '../../lib/useDebounce'
import { api } from '../../lib/api'
import type { StatusMeta } from '../../lib/statusLabels'

const LIMIT = 20

type ReqStatus = 'new' | 'forwarded' | 'closed'

interface ExpertRequest {
  id: string
  expert_id: string
  expert_slug: string
  expert_name: string
  customer_name: string
  customer_phone: string
  customer_email: string
  city: string
  topic: string
  message: string
  status: ReqStatus
  created_at: string
}

function statusMeta(status: ReqStatus): StatusMeta {
  switch (status) {
    case 'forwarded':
      return { label: 'İletildi', variant: 'warning' }
    case 'closed':
      return { label: 'Kapandı', variant: 'neutral' }
    default:
      return { label: 'Yeni', variant: 'info' }
  }
}

export default function ExpertRequests() {
  const { notify } = useToast()
  const qc = useQueryClient()
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<ExpertRequest | null>(null)
  const debounced = useDebounce(search)

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['expert-requests', offset, debounced, statusFilter],
    queryFn: () =>
      api.get<{ requests: ExpertRequest[]; count: number }>('/admin/expert-requests', {
        limit: LIMIT,
        offset,
        q: debounced || undefined,
        status: statusFilter || undefined,
      }),
    placeholderData: keepPreviousData,
  })
  const requests = data?.requests ?? []

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReqStatus }) =>
      api.post(`/admin/expert-requests/${id}`, { status }),
    onSuccess: () => {
      notify('Talep durumu güncellendi.')
      qc.invalidateQueries({ queryKey: ['expert-requests'] })
      setSelected(null)
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/expert-requests/${id}`),
    onSuccess: () => {
      notify('Talep silindi.')
      qc.invalidateQueries({ queryKey: ['expert-requests'] })
      setSelected(null)
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const handleDelete = (id: string) => {
    if (window.confirm('Bu talebi kalıcı olarak silmek istediğinize emin misiniz?')) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <>
      <Header
        title="Uzman Hizmet Talepleri"
        subtitle="Halkın uzman/uygulayıcı profillerine bıraktığı hizmet taleplerini görün ve takip edin"
      />

      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div className="header__search" style={{ flex: 1, minWidth: '220px' }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Müşteri, uzman veya şehir ara..."
              className="header__search-input"
              style={{ width: '100%' }}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setOffset(0)
              }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setOffset(0)
            }}
            style={{ width: 'auto', minWidth: '160px' }}
          >
            <option value="">Tüm Durumlar</option>
            <option value="new">Yeni</option>
            <option value="forwarded">İletildi</option>
            <option value="closed">Kapandı</option>
          </select>
        </div>

        {isLoading ? (
          <LoadingState label="Talepler yükleniyor..." />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : requests.length === 0 ? (
          <EmptyState
            icon={<Inbox size={26} />}
            title="Talep bulunamadı"
            description={
              search || statusFilter
                ? 'Filtreye uygun talep yok.'
                : 'Henüz uzman profillerine bırakılmış bir talep yok. /uzmanlar profil sayfalarındaki "Talep Bırak" formundan gelir.'
            }
          />
        ) : (
          <>
            <div className="table-container animate-fadeIn" style={{ opacity: isFetching ? 0.7 : 1 }}>
              <table>
                <thead>
                  <tr>
                    <th>Müşteri</th>
                    <th>İletişim</th>
                    <th>Hedef Uzman</th>
                    <th>Konu</th>
                    <th>Durum</th>
                    <th>Tarih</th>
                    <th style={{ textAlign: 'right' }}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.customer_name}</div>
                        {r.city && (
                          <div className="muted" style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={11} /> {r.city}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.82rem' }}>
                          <div>{r.customer_phone || '—'}</div>
                          <div className="muted">{r.customer_email || '—'}</div>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{r.expert_name}</td>
                      <td style={{ fontSize: '0.85rem', maxWidth: 220 }}>{r.topic || '—'}</td>
                      <td><Badge status={statusMeta(r.status)} /></td>
                      <td className="muted" style={{ fontSize: '0.82rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={13} /> {new Date(r.created_at).toLocaleDateString('tr-TR')}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn--secondary btn--icon btn--sm"
                            title="Detay"
                            onClick={() => setSelected(r)}
                          >
                            <Eye size={14} />
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

      {selected && (
        <Modal title="Hizmet Talebi Detayı" onClose={() => setSelected(null)} size="md">
          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
              <div>
                <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>Müşteri</span>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <User size={13} /> {selected.customer_name}
                </strong>
              </div>
              <div>
                <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>İletişim</span>
                <div style={{ marginTop: '4px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={12} /> {selected.customer_phone || '—'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={12} /> {selected.customer_email || '—'}</div>
                </div>
              </div>
              <div>
                <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>Hedef Uzman</span>
                <div style={{ marginTop: '4px', fontSize: '0.85rem' }}>{selected.expert_name}</div>
                {selected.city && <div className="muted" style={{ fontSize: '0.78rem' }}>Şehir: {selected.city}</div>}
              </div>
              <div>
                <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>Konu</span>
                <div style={{ marginTop: '4px', fontSize: '0.85rem' }}>{selected.topic || '—'}</div>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageSquare size={16} className="muted" /> Mesaj
              </h4>
              <p style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                {selected.message || '—'}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-primary)', paddingTop: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="muted">Durum:</span>
                <Badge status={statusMeta(selected.status)} />
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button className="btn btn--secondary" onClick={() => handleDelete(selected.id)}>
                  <Trash2 size={14} /> Sil
                </button>
                {selected.status !== 'closed' && (
                  <button className="btn btn--secondary" onClick={() => updateMutation.mutate({ id: selected.id, status: 'closed' })} disabled={updateMutation.isPending}>
                    Kapat
                  </button>
                )}
                {selected.status !== 'forwarded' && (
                  <button className="btn btn--primary" onClick={() => updateMutation.mutate({ id: selected.id, status: 'forwarded' })} disabled={updateMutation.isPending}>
                    İletildi İşaretle
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

function EmptyState({ icon, title, description }: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: '16px', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        {icon}
      </div>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{title}</h3>
      <p style={{ color: 'var(--text-tertiary)', maxWidth: 400, fontSize: '0.9rem' }}>{description}</p>
    </div>
  )
}
