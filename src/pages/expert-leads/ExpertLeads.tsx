import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  UserCheck,
  Search,
  Eye,
  Phone,
  Mail,
  MapPin,
  Calendar,
  FileText,
  Trash2,
  BadgeCheck,
  Wallet,
  Briefcase,
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

// Backend src/lib/expert-config.ts ile eş tutulmalı (TR etiketler).
// Mühendis (engineer) uzmanlıkları
const ENGINEER_SPEC_LABELS: Record<string, string> = {
  risk_tespit: 'Bina Risk & Hasar Tespiti',
  guclendirme: 'Güçlendirme Projesi (Retrofit Tasarım)',
  statik_proje: 'Statik / Betonarme Proje',
  zemin_etut: 'Zemin Etüdü & Geoteknik',
  yapi_denetim: 'Yapı Denetimi',
  kentsel_donusum: 'Kentsel Dönüşüm Danışmanlığı',
  performans_analizi: 'Deprem Performans Analizi',
}
// Uygulayıcı (implementer) uygulama alanları
const IMPLEMENTER_SPEC_LABELS: Record<string, string> = {
  guclendirme_uygulama: 'Güçlendirme Uygulaması (Retrofit)',
  karbon_fiber: 'Karbon Fiber / FRP Güçlendirme',
  celik_guclendirme: 'Çelik Güçlendirme',
  temel_perde: 'Temel & Perde / Mantolama Uygulaması',
  insaat_yapim: 'İnşaat / Kaba Yapım',
  zemin_iyilestirme: 'Zemin İyileştirme Uygulaması',
  yikim_hafriyat: 'Yıkım & Hafriyat',
  tadilat_onarim: 'Tadilat & Onarım',
}
const SPEC_LABELS: Record<string, string> = {
  ...ENGINEER_SPEC_LABELS,
  ...IMPLEMENTER_SPEC_LABELS,
}
const PROVIDER_LABELS: Record<string, string> = {
  engineer: 'Mühendis',
  implementer: 'Uygulayıcı',
}
const BUDGET_LABELS: Record<string, string> = {
  unsure: 'Henüz emin değil',
  '0_250': 'Aylık 0 – 250 ₺',
  '250_500': 'Aylık 250 – 500 ₺',
  '500_1000': 'Aylık 500 – 1.000 ₺',
  '1000_plus': 'Aylık 1.000 ₺ +',
}

type LeadStatus = 'new' | 'contacted' | 'approved' | 'archived'

interface ExpertLead {
  id: string
  provider_type: 'engineer' | 'implementer'
  full_name: string
  title: string
  email: string
  phone: string
  city: string
  district: string
  specializations: string[]
  experience_years: number | null
  imo_member: boolean
  service_areas: string
  budget_tier: string
  message: string
  notes: string
  status: LeadStatus
  created_at: string
}

function statusMeta(status: LeadStatus): StatusMeta {
  switch (status) {
    case 'approved':
      return { label: 'Onaylandı', variant: 'success' }
    case 'contacted':
      return { label: 'İletişime Geçildi', variant: 'warning' }
    case 'archived':
      return { label: 'Arşivlendi', variant: 'neutral' }
    default:
      return { label: 'Yeni', variant: 'info' }
  }
}

function specLabel(key: string): string {
  return SPEC_LABELS[key] ?? key
}

export default function ExpertLeads() {
  const { notify } = useToast()
  const qc = useQueryClient()
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [providerFilter, setProviderFilter] = useState<string>('')
  const [specFilter, setSpecFilter] = useState<string>('')
  const [selected, setSelected] = useState<ExpertLead | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const debounced = useDebounce(search)

  useEffect(() => {
    setNoteDraft(selected?.notes ?? '')
  }, [selected])

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['expert-leads', offset, debounced, statusFilter, providerFilter, specFilter],
    queryFn: () =>
      api.get<{ leads: ExpertLead[]; count: number }>('/admin/expert-leads', {
        limit: LIMIT,
        offset,
        q: debounced || undefined,
        status: statusFilter || undefined,
        provider_type: providerFilter || undefined,
        specialization: specFilter || undefined,
      }),
    placeholderData: keepPreviousData,
  })
  const leads = data?.leads ?? []

  const updateMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status?: LeadStatus; notes?: string }) =>
      api.post(`/admin/expert-leads/${id}`, { status, notes }),
    onSuccess: (_r, vars) => {
      const msg: Record<string, string> = {
        approved: 'Ön kayıt onaylandı (dizine alınacak).',
        contacted: 'İletişime geçildi olarak işaretlendi.',
        archived: 'Ön kayıt arşivlendi.',
        new: 'Yeniden "yeni" durumuna alındı.',
      }
      notify(vars.status ? (msg[vars.status] ?? 'Durum güncellendi.') : 'Not kaydedildi.')
      qc.invalidateQueries({ queryKey: ['expert-leads'] })
      if (vars.status) setSelected(null)
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/expert-leads/${id}`),
    onSuccess: () => {
      notify('Ön kayıt silindi.')
      qc.invalidateQueries({ queryKey: ['expert-leads'] })
      setSelected(null)
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const setStatus = (id: string, status: LeadStatus) => updateMutation.mutate({ id, status })
  const saveNote = () => {
    if (selected) updateMutation.mutate({ id: selected.id, notes: noteDraft })
  }
  const handleDelete = (id: string) => {
    if (window.confirm('Bu ön kaydı kalıcı olarak silmek istediğinize emin misiniz?')) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <>
      <Header
        title="Uzman & Uygulayıcı Ön Kayıtları"
        subtitle="İnşaat mühendisi (tespit/proje) ve uygulayıcı (inşaat/güçlendirme) dizini ön-kayıtlarını inceleyin"
      />

      <div style={{ padding: '24px' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div className="header__search" style={{ flex: 1, minWidth: '220px' }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Ad soyad, e-posta veya şehir ara..."
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
            value={providerFilter}
            onChange={(e) => {
              setProviderFilter(e.target.value)
              setOffset(0)
            }}
            style={{ width: 'auto', minWidth: '150px' }}
          >
            <option value="">Tüm Roller</option>
            <option value="engineer">Mühendis</option>
            <option value="implementer">Uygulayıcı</option>
          </select>
          <select
            value={specFilter}
            onChange={(e) => {
              setSpecFilter(e.target.value)
              setOffset(0)
            }}
            style={{ width: 'auto', minWidth: '180px' }}
          >
            <option value="">Tüm Uzmanlıklar</option>
            <optgroup label="Mühendis">
              {Object.entries(ENGINEER_SPEC_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </optgroup>
            <optgroup label="Uygulayıcı">
              {Object.entries(IMPLEMENTER_SPEC_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </optgroup>
          </select>
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
            <option value="contacted">İletişime Geçildi</option>
            <option value="approved">Onaylandı</option>
            <option value="archived">Arşivlendi</option>
          </select>
        </div>

        {isLoading ? (
          <LoadingState label="Ön kayıtlar yükleniyor..." />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : leads.length === 0 ? (
          <EmptyState
            icon={<UserCheck size={26} />}
            title="Ön kayıt bulunamadı"
            description={
              search || statusFilter || specFilter
                ? 'Filtreye uygun ön kayıt yok.'
                : 'Henüz uzman ön kaydı bulunmamaktadır. /uzman-ol sayfası üzerinden gelir.'
            }
          />
        ) : (
          <>
            <div className="table-container animate-fadeIn" style={{ opacity: isFetching ? 0.7 : 1 }}>
              <table>
                <thead>
                  <tr>
                    <th>Kişi / Rol</th>
                    <th>İletişim</th>
                    <th>Şehir</th>
                    <th>Uzmanlıklar</th>
                    <th>Durum</th>
                    <th>Tarih</th>
                    <th style={{ textAlign: 'right' }}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id}>
                      <td>
                        <div>
                          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {lead.full_name}
                            {lead.imo_member && (
                              <BadgeCheck size={14} style={{ color: 'var(--accent-success)' }} aria-label="İMO üyesi" />
                            )}
                          </div>
                          <div style={{ marginTop: '3px' }}>
                            <span
                              className={`badge ${lead.provider_type === 'implementer' ? 'badge--warning' : 'badge--info'}`}
                              style={{ fontSize: '0.66rem' }}
                            >
                              {PROVIDER_LABELS[lead.provider_type] ?? 'Mühendis'}
                            </span>
                          </div>
                          <div className="muted" style={{ fontSize: '0.78rem', marginTop: '2px' }}>
                            {lead.title || '—'}
                            {lead.experience_years != null ? ` · ${lead.experience_years} yıl` : ''}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.82rem' }}>
                          <div>{lead.email}</div>
                          <div className="muted">{lead.phone || '—'}</div>
                        </div>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem' }}>
                          <MapPin size={13} className="muted" /> {[lead.city, lead.district].filter(Boolean).join(' / ') || '—'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: 260 }}>
                          {(lead.specializations ?? []).slice(0, 2).map((s) => (
                            <span key={s} className="badge badge--neutral" style={{ fontSize: '0.68rem' }}>
                              {specLabel(s)}
                            </span>
                          ))}
                          {(lead.specializations?.length ?? 0) > 2 && (
                            <span className="muted" style={{ fontSize: '0.72rem' }}>
                              +{(lead.specializations?.length ?? 0) - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <Badge status={statusMeta(lead.status)} />
                      </td>
                      <td className="muted" style={{ fontSize: '0.82rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={13} /> {new Date(lead.created_at).toLocaleDateString('tr-TR')}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn--secondary btn--icon btn--sm"
                            title="Detayları İncele"
                            onClick={() => setSelected(lead)}
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

      {/* Detail Modal */}
      {selected && (
        <Modal title="Uzman Ön Kayıt Detayı" onClose={() => setSelected(null)} size="lg">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                background: 'var(--bg-secondary)',
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-primary)',
              }}
            >
              <div>
                <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>Ad Soyad & Unvan</span>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  {selected.full_name}
                  {selected.imo_member && <BadgeCheck size={14} style={{ color: 'var(--accent-success)' }} />}
                  <span
                    className={`badge ${selected.provider_type === 'implementer' ? 'badge--warning' : 'badge--info'}`}
                    style={{ fontSize: '0.66rem' }}
                  >
                    {PROVIDER_LABELS[selected.provider_type] ?? 'Mühendis'}
                  </span>
                </strong>
                <div className="muted" style={{ fontSize: '0.82rem' }}>{selected.title || '—'}</div>
              </div>
              <div>
                <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>İletişim</span>
                <div style={{ marginTop: '4px', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={12} /> {selected.email}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={12} /> {selected.phone || '—'}</div>
                </div>
              </div>
              <div>
                <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>Konum</span>
                <div style={{ marginTop: '4px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={12} /> {[selected.city, selected.district].filter(Boolean).join(' / ') || '—'}
                </div>
                {selected.service_areas && (
                  <div className="muted" style={{ fontSize: '0.78rem', marginTop: '2px' }}>Ek bölge: {selected.service_areas}</div>
                )}
              </div>
              <div>
                <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>Deneyim & Bütçe</span>
                <div style={{ marginTop: '4px', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Briefcase size={12} /> {selected.experience_years != null ? `${selected.experience_years} yıl` : '—'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Wallet size={12} /> {BUDGET_LABELS[selected.budget_tier] ?? '—'}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '8px' }}>Uzmanlık Alanları</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(selected.specializations ?? []).map((s) => (
                  <span key={s} className="badge badge--info">{specLabel(s)}</span>
                ))}
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={16} className="muted" /> Beklenti / İhtiyaç (mühendisin fikri)
              </h4>
              <p style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                {selected.message || '—'}
              </p>
            </div>

            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '8px' }}>Admin Notu (iç)</h4>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={3}
                placeholder="İç not ekleyin (örn. arandı, belge istendi)..."
                style={{ width: '100%', resize: 'vertical' }}
              />
              <div style={{ marginTop: '6px', textAlign: 'right' }}>
                <button
                  className="btn btn--secondary btn--sm"
                  onClick={saveNote}
                  disabled={updateMutation.isPending || noteDraft === selected.notes}
                >
                  Notu Kaydet
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', borderTop: '1px solid var(--border-primary)', paddingTop: '16px' }}>
              <div>
                <span className="muted" style={{ marginRight: '8px' }}>Durum:</span>
                <Badge status={statusMeta(selected.status)} />
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button className="btn btn--secondary" onClick={() => handleDelete(selected.id)} title="Sil">
                  <Trash2 size={14} /> Sil
                </button>
                {selected.status !== 'archived' && (
                  <button className="btn btn--secondary" onClick={() => setStatus(selected.id, 'archived')}>
                    Arşivle
                  </button>
                )}
                {selected.status !== 'contacted' && (
                  <button className="btn btn--warning" onClick={() => setStatus(selected.id, 'contacted')}>
                    İletişime Geçildi
                  </button>
                )}
                {selected.status !== 'approved' && (
                  <button className="btn btn--primary" onClick={() => setStatus(selected.id, 'approved')}>
                    Onayla
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
