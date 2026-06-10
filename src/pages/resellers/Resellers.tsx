import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  Handshake,
  Search,
  Eye,
  Check,
  X,
  Building,
  User,
  MapPin,
  Calendar,
  FileText
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

const LIMIT = 20

interface ResellerApplication {
  id: string
  company_name: string
  applicant_name: string
  email: string
  phone: string
  city: string
  tax_number: string
  status: 'pending' | 'approved' | 'rejected'
  message: string
  created_at: string
}

export default function Resellers() {
  const { notify } = useToast()
  const qc = useQueryClient()
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedApp, setSelectedApp] = useState<ResellerApplication | null>(null)
  const debounced = useDebounce(search)

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['resellers', offset, debounced, statusFilter],
    queryFn: () =>
      api.get<{ applications: ResellerApplication[]; count: number }>('/admin/reseller-applications', {
        limit: LIMIT,
        offset,
        q: debounced || undefined,
        status: statusFilter || undefined,
      }),
    placeholderData: keepPreviousData,
  })
  const filteredApps = data?.applications ?? []

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' | 'pending' }) =>
      api.post(`/admin/reseller-applications/${id}`, { status }),
    onSuccess: (_r, vars) => {
      notify(vars.status === 'approved' ? 'Bayilik başvurusu onaylandı.' : 'Bayilik başvurusu reddedildi.')
      qc.invalidateQueries({ queryKey: ['resellers'] })
      setSelectedApp(null)
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const handleApprove = (id: string) => {
    if (window.confirm('Bu bayilik başvurusunu onaylamak istediğinize emin misiniz?')) {
      statusMutation.mutate({ id, status: 'approved' })
    }
  }

  const handleReject = (id: string) => {
    if (window.confirm('Bu bayilik başvurusunu reddetmek istediğinize emin misiniz?')) {
      statusMutation.mutate({ id, status: 'rejected' })
    }
  }

  return (
    <>
      <Header title="Bayilik Başvuruları" subtitle="Gelen bayi başvurularını inceleyin ve durumlarını yönetin" />

      <div style={{ padding: '24px' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div className="header__search" style={{ flex: 1, minWidth: '220px' }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Şirket, başvuru sahibi veya şehir ara..."
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
            <option value="pending">Bekleyenler</option>
            <option value="approved">Onaylananlar</option>
            <option value="rejected">Reddedilenler</option>
          </select>
        </div>

        {/* Content list */}
        {isLoading ? (
          <LoadingState label="Başvurular yükleniyor..." />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : filteredApps.length === 0 ? (
          <EmptyState
            icon={<Handshake size={26} />}
            title="Başvuru bulunamadı"
            description={search || statusFilter ? 'Filtreye uygun bayilik başvurusu yok.' : 'Henüz başvuru bulunmamaktadır.'}
          />
        ) : (
          <>
          <div className="table-container animate-fadeIn" style={{ opacity: isFetching ? 0.7 : 1 }}>
            <table>
              <thead>
                <tr>
                  <th>Firma Adı</th>
                  <th>Başvuru Sahibi</th>
                  <th>Şehir</th>
                  <th>Durum</th>
                  <th>Başvuru Tarihi</th>
                  <th style={{ textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredApps.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Building size={14} className="muted" /> {app.company_name}
                        </div>
                        <div className="muted" style={{ fontSize: '0.78rem', marginTop: '2px' }}>
                          Vergi No: {app.tax_number}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 500 }}>{app.applicant_name}</div>
                        <div className="muted" style={{ fontSize: '0.78rem' }}>{app.phone}</div>
                      </div>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem' }}>
                        <MapPin size={13} className="muted" /> {app.city}
                      </span>
                    </td>
                    <td>
                      <Badge
                        status={
                          app.status === 'approved'
                            ? { label: 'Onaylandı', variant: 'success' }
                            : app.status === 'rejected'
                            ? { label: 'Reddedildi', variant: 'danger' }
                            : { label: 'Beklemede', variant: 'warning' }
                        }
                      />
                    </td>
                    <td className="muted" style={{ fontSize: '0.82rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={13} /> {new Date(app.created_at).toLocaleDateString('tr-TR')}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn--secondary btn--icon btn--sm"
                          title="Detayları İncele"
                          onClick={() => setSelectedApp(app)}
                        >
                          <Eye size={14} />
                        </button>
                        {app.status === 'pending' && (
                          <>
                            <button
                              className="btn btn--secondary btn--icon btn--sm"
                              style={{ color: 'var(--accent-success)' }}
                              title="Onayla"
                              onClick={() => handleApprove(app.id)}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              className="btn btn--secondary btn--icon btn--sm"
                              style={{ color: 'var(--accent-danger)' }}
                              title="Reddet"
                              onClick={() => handleReject(app.id)}
                            >
                              <X size={14} />
                            </button>
                          </>
                        )}
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

      {/* Detail Modal */}
      {selectedApp && (
        <Modal title="Bayilik Başvuru Detayı" onClose={() => setSelectedApp(null)} size="lg">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                background: 'var(--bg-secondary)',
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-primary)'
              }}
            >
              <div>
                <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>Şirket Unvanı</span>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <Building size={14} /> {selectedApp.company_name}
                </strong>
              </div>
              <div>
                <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>Yetkili Kişi</span>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <User size={14} /> {selectedApp.applicant_name}
                </strong>
              </div>
              <div>
                <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>E-posta & Telefon</span>
                <div style={{ marginTop: '4px', fontSize: '0.875rem' }}>
                  <div>{selectedApp.email}</div>
                  <div>{selectedApp.phone}</div>
                </div>
              </div>
              <div>
                <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>Şehir & Vergi No</span>
                <div style={{ marginTop: '4px', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={12} /> {selectedApp.city}
                  </div>
                  <div>Vergi No: {selectedApp.tax_number}</div>
                </div>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={16} className="muted" /> Başvuru Mesajı / Niyet Mektubu
              </h4>
              <p style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                {selectedApp.message}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', borderTop: '1px solid var(--border-primary)', paddingTop: '16px' }}>
              <div>
                <span className="muted" style={{ marginRight: '8px' }}>Başvuru Durumu:</span>
                <Badge
                  status={
                    selectedApp.status === 'approved'
                      ? { label: 'Onaylandı', variant: 'success' }
                      : selectedApp.status === 'rejected'
                      ? { label: 'Reddedildi', variant: 'danger' }
                      : { label: 'Beklemede', variant: 'warning' }
                  }
                />
              </div>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn--secondary" onClick={() => setSelectedApp(null)}>
                  Kapat
                </button>
                {selectedApp.status === 'pending' && (
                  <>
                    <button className="btn btn--danger" onClick={() => handleReject(selectedApp.id)}>
                      Başvuruyu Reddet
                    </button>
                    <button className="btn btn--primary" onClick={() => handleApprove(selectedApp.id)}>
                      Başvuruyu Onayla
                    </button>
                  </>
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
