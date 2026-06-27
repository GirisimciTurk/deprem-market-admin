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
  Upload,
  ExternalLink,
  Globe,
  MessageCircle,
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
import { API_BASE, getToken } from '../../lib/auth'
import type { StatusMeta } from '../../lib/statusLabels'

const LIMIT = 20
const STOREFRONT_URL = import.meta.env.VITE_STOREFRONT_URL || 'http://localhost:8000'

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
const DOC_TYPE_LABELS: Record<string, string> = {
  diploma: 'Diploma',
  oda: 'Oda Kaydı (İMO)',
  yetki: 'Yetki Belgesi / Vergi Mükellefiyeti',
  lisans: 'Lisans / Ruhsat',
  diger: 'Diğer Belge',
}
const MEMBERSHIP_LABELS: Record<string, string> = {
  none: 'Standart (ücretsiz liste)',
  basic: 'Temel Üyelik',
  premium: 'Üst Üyelik (öne çıkar)',
}
// Paket başına izin verilen EK hizmet bölgesi (backend MEMBERSHIP_REGION_LIMITS ile eş).
const REGION_LIMITS: Record<string, number> = { none: 1, basic: 3, premium: 10 }
// Belge–uzmanlık eşleşmesi (backend src/lib/expert-config.ts ile eş tutulmalı).
const SPEC_REQUIRED_DOCS: Record<string, string[]> = {
  risk_tespit: ['diploma', 'oda'], guclendirme: ['diploma', 'oda'], statik_proje: ['diploma', 'oda'],
  zemin_etut: ['diploma', 'oda'], yapi_denetim: ['diploma', 'oda', 'lisans'], kentsel_donusum: ['diploma', 'oda'],
  performans_analizi: ['diploma', 'oda'], guclendirme_uygulama: ['yetki'], karbon_fiber: ['yetki'],
  celik_guclendirme: ['yetki'], temel_perde: ['yetki'], insaat_yapim: ['yetki', 'lisans'],
  zemin_iyilestirme: ['yetki'], yikim_hafriyat: ['yetki', 'lisans'], tadilat_onarim: ['yetki'],
}
function requiredDocsLabel(specKey: string): string {
  return (SPEC_REQUIRED_DOCS[specKey] ?? []).map((d) => DOC_TYPE_LABELS[d] ?? d).join(', ')
}

type LeadStatus = 'new' | 'contacted' | 'approved' | 'archived'

interface ExpertDoc {
  type: string
  url: string
  name?: string
}

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
  verified_specializations?: string[]
  experience_years: number | null
  imo_member: boolean
  service_areas: string
  service_regions?: { city: string; district?: string }[]
  budget_tier: string
  message: string
  notes: string
  status: LeadStatus
  created_at: string
  // Dizin profili
  about?: string
  photo_url?: string
  whatsapp?: string
  show_phone?: boolean
  show_email?: boolean
  documents?: ExpertDoc[] | null
  slug?: string | null
  is_published?: boolean
  published_at?: string | null
  membership_tier?: 'none' | 'basic' | 'premium'
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

interface ProfileDraft {
  about: string
  photo_url: string
  whatsapp: string
  show_phone: boolean
  show_email: boolean
  slug: string
  documents: ExpertDoc[]
  membership_tier: 'none' | 'basic' | 'premium'
  verified_specializations: string[]
  service_regions: { city: string; district?: string }[]
}

function toDraft(l: ExpertLead): ProfileDraft {
  return {
    about: l.about ?? '',
    photo_url: l.photo_url ?? '',
    whatsapp: l.whatsapp ?? '',
    show_phone: l.show_phone ?? true,
    show_email: l.show_email ?? false,
    slug: l.slug ?? '',
    documents: Array.isArray(l.documents) ? l.documents : [],
    membership_tier: l.membership_tier ?? 'none',
    verified_specializations: Array.isArray(l.verified_specializations)
      ? l.verified_specializations
      : (l.specializations ?? []),
    service_regions: Array.isArray(l.service_regions) ? l.service_regions.map((r) => ({ city: r.city, district: r.district })) : [],
  }
}

export default function ExpertLeads() {
  const { notify } = useToast()
  const qc = useQueryClient()
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [providerFilter, setProviderFilter] = useState<string>('')
  const [specFilter, setSpecFilter] = useState<string>('')
  const [publishedFilter, setPublishedFilter] = useState<string>('')
  const [selected, setSelected] = useState<ExpertLead | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [profile, setProfile] = useState<ProfileDraft | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const debounced = useDebounce(search)

  useEffect(() => {
    setNoteDraft(selected?.notes ?? '')
    setProfile(selected ? toDraft(selected) : null)
  }, [selected])

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['expert-leads', offset, debounced, statusFilter, providerFilter, specFilter, publishedFilter],
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
  let leads = data?.leads ?? []
  if (publishedFilter === 'published') leads = leads.filter((l) => l.is_published)
  else if (publishedFilter === 'unpublished') leads = leads.filter((l) => !l.is_published)

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

  // Profil kaydet / yayınla — döndürülen güncel kaydı seçili tut (slug görünür olsun).
  const profileMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<{ lead: ExpertLead }>(`/admin/expert-leads/${selected!.id}`, payload),
    onSuccess: (r, vars) => {
      if (r?.lead) setSelected(r.lead)
      notify(
        'is_published' in vars
          ? vars.is_published
            ? 'Profil yayınlandı — dizinde görünür.'
            : 'Profil yayından kaldırıldı.'
          : 'Profil kaydedildi.'
      )
      qc.invalidateQueries({ queryKey: ['expert-leads'] })
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

  const saveProfile = () => {
    if (!profile) return
    profileMutation.mutate({
      about: profile.about,
      photo_url: profile.photo_url,
      whatsapp: profile.whatsapp,
      show_phone: profile.show_phone,
      show_email: profile.show_email,
      documents: profile.documents,
      membership_tier: profile.membership_tier,
      verified_specializations: profile.verified_specializations,
      service_regions: profile.service_regions.filter((r) => r.city?.trim()),
      ...(profile.slug ? { slug: profile.slug } : {}),
    })
  }
  const togglePublish = () => {
    if (!selected || !profile) return
    const next = !selected.is_published
    profileMutation.mutate({
      is_published: next,
      // Yayınlarken güncel profil alanlarını da gönder (kaydetmeyi unutmaya karşı).
      ...(next
        ? {
            about: profile.about,
            photo_url: profile.photo_url,
            whatsapp: profile.whatsapp,
            show_phone: profile.show_phone,
            show_email: profile.show_email,
            documents: profile.documents,
            membership_tier: profile.membership_tier,
            ...(profile.slug ? { slug: profile.slug } : {}),
          }
        : {}),
    })
  }

  // /admin/uploads (multipart) — fotoğraf & belge yükleme (ProductEdit deseni).
  const uploadFiles = async (files: FileList): Promise<{ url: string }[]> => {
    const token = getToken()
    const fd = new FormData()
    for (let i = 0; i < files.length; i++) fd.append('files', files[i])
    const res = await fetch(`${API_BASE}/admin/uploads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      throw new Error(err?.message || `Yükleme başarısız (HTTP ${res.status})`)
    }
    const data = (await res.json()) as { files?: { url: string }[] }
    return data.files ?? []
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length || !profile) return
    setUploadingPhoto(true)
    try {
      const out = await uploadFiles(files)
      if (out[0]?.url) {
        setProfile({ ...profile, photo_url: out[0].url })
        notify('Fotoğraf yüklendi. Kaydetmeyi unutmayın.')
      }
    } catch (err: any) {
      notify(err.message || 'Fotoğraf yüklenemedi.', 'error')
    } finally {
      setUploadingPhoto(false)
      e.target.value = ''
    }
  }

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length || !profile) return
    setUploadingDoc(true)
    try {
      const out = await uploadFiles(files)
      const newDocs: ExpertDoc[] = out
        .filter((f) => f.url)
        .map((f, i) => ({ type: 'diger', url: f.url, name: files[i]?.name || 'Belge' }))
      if (newDocs.length) {
        setProfile({ ...profile, documents: [...profile.documents, ...newDocs] })
        notify(`${newDocs.length} belge yüklendi. Kaydetmeyi unutmayın.`)
      }
    } catch (err: any) {
      notify(err.message || 'Belge yüklenemedi.', 'error')
    } finally {
      setUploadingDoc(false)
      e.target.value = ''
    }
  }

  const setDocType = (idx: number, type: string) => {
    if (!profile) return
    setProfile({
      ...profile,
      documents: profile.documents.map((d, i) => (i === idx ? { ...d, type } : d)),
    })
  }
  const removeDoc = (idx: number) => {
    if (!profile) return
    setProfile({ ...profile, documents: profile.documents.filter((_, i) => i !== idx) })
  }

  return (
    <>
      <Header
        title="Uzman & Uygulayıcı Ön Kayıtları"
        subtitle="İnşaat mühendisi (tespit/proje) ve uygulayıcı (inşaat/güçlendirme) dizini ön-kayıtlarını inceleyin, doğrulayın ve yayınlayın"
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
            value={publishedFilter}
            onChange={(e) => {
              setPublishedFilter(e.target.value)
              setOffset(0)
            }}
            style={{ width: 'auto', minWidth: '150px' }}
          >
            <option value="">Tüm Yayın Durumu</option>
            <option value="published">Yayında</option>
            <option value="unpublished">Yayında Değil</option>
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
              search || statusFilter || specFilter || publishedFilter
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
                          <div style={{ marginTop: '3px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            <span
                              className={`badge ${lead.provider_type === 'implementer' ? 'badge--warning' : 'badge--info'}`}
                              style={{ fontSize: '0.66rem' }}
                            >
                              {PROVIDER_LABELS[lead.provider_type] ?? 'Mühendis'}
                            </span>
                            {lead.is_published && (
                              <span className="badge badge--success" style={{ fontSize: '0.66rem' }}>
                                Yayında
                              </span>
                            )}
                            {lead.membership_tier === 'premium' && (
                              <span className="badge badge--warning" style={{ fontSize: '0.66rem' }}>
                                ★ Üst
                              </span>
                            )}
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
      {selected && profile && (
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
                <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
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
                {(selected.service_regions?.length ?? 0) > 0 && (
                  <div className="muted" style={{ fontSize: '0.78rem', marginTop: '2px' }}>
                    Ek bölgeler: {selected.service_regions!.map((r) => [r.city, r.district].filter(Boolean).join('/')).join(', ')}
                  </div>
                )}
                {selected.service_areas && (
                  <div className="muted" style={{ fontSize: '0.78rem', marginTop: '2px' }}>Not: {selected.service_areas}</div>
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
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '4px' }}>Uzmanlık Alanları — Bazlı Doğrulama</h4>
              <p className="muted" style={{ fontSize: '0.78rem', marginBottom: '8px' }}>
                Her uzmanlığı AYRI doğrulayın. Yalnız ✓ işaretli (doğrulanmış) uzmanlıklar dizinde filtrelenir ve profilde "doğrulanmış" görünür.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(selected.specializations ?? []).map((s) => {
                  const ok = profile.verified_specializations.includes(s)
                  return (
                    <button
                      type="button"
                      key={s}
                      onClick={() =>
                        setProfile({
                          ...profile,
                          verified_specializations: ok
                            ? profile.verified_specializations.filter((k) => k !== s)
                            : [...profile.verified_specializations, s],
                        })
                      }
                      className={`badge ${ok ? 'badge--success' : 'badge--neutral'}`}
                      style={{ cursor: 'pointer', border: 'none' }}
                      title={ok ? 'Doğrulandı — kaldırmak için tıkla' : 'Doğrulanmadı — doğrulamak için tıkla'}
                    >
                      {ok ? '✓ ' : '○ '}{specLabel(s)}
                    </button>
                  )
                })}
              </div>
              <div style={{ marginTop: '8px', fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>
                <strong style={{ color: 'var(--text-secondary)' }}>Gerekli belgeler (uzmanlık bazında):</strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: '16px' }}>
                  {(selected.specializations ?? []).map((s) => (
                    <li key={s}>{specLabel(s)} → {requiredDocsLabel(s) || 'belirtilmedi'}</li>
                  ))}
                </ul>
              </div>
              <p className="muted" style={{ fontSize: '0.72rem', marginTop: '6px' }}>
                Doğrulama "Profili Kaydet" veya "Yayınla" ile kaydedilir.
              </p>
            </div>

            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={16} className="muted" /> Beklenti / İhtiyaç (başvuru notu)
              </h4>
              <p style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                {selected.message || '—'}
              </p>
            </div>

            {/* --- DİZİN PROFİLİ EDİTÖRÜ --- */}
            <div
              style={{
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'grid',
                gap: '16px',
                background: 'var(--bg-primary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Globe size={16} className="muted" /> Herkese Açık Dizin Profili
                </h4>
                {selected.is_published && selected.slug && (
                  <a
                    href={`${STOREFRONT_URL}/tr/uzmanlar/${selected.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn--secondary btn--sm"
                  >
                    <ExternalLink size={13} /> Profili Gör
                  </a>
                )}
              </div>

              {/* Foto + about */}
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '16px', alignItems: 'start' }}>
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      width: 88, height: 88, borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-tertiary)', overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1px solid var(--border-primary)', marginBottom: '8px',
                    }}
                  >
                    {profile.photo_url ? (
                      <img src={profile.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <UserCheck size={28} className="muted" />
                    )}
                  </div>
                  <label className="btn btn--secondary btn--sm" style={{ cursor: 'pointer' }}>
                    <Upload size={13} /> {uploadingPhoto ? '...' : 'Foto'}
                    <input type="file" accept="image/*" hidden disabled={uploadingPhoto} onChange={handlePhotoUpload} />
                  </label>
                </div>
                <div>
                  <label className="muted" style={{ fontSize: '0.78rem', display: 'block', marginBottom: '4px' }}>
                    Hakkında (profilde görünür)
                  </label>
                  <textarea
                    value={profile.about}
                    onChange={(e) => setProfile({ ...profile, about: e.target.value })}
                    rows={4}
                    maxLength={2000}
                    placeholder="Kısa biyografi, uzmanlık özeti, öne çıkan projeler..."
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* İletişim tercihleri + slug */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div>
                  <label className="muted" style={{ fontSize: '0.78rem', display: 'block', marginBottom: '4px' }}>
                    WhatsApp (ülke kodlu, opsiyonel)
                  </label>
                  <input
                    type="text"
                    value={profile.whatsapp}
                    onChange={(e) => setProfile({ ...profile, whatsapp: e.target.value })}
                    placeholder="905321112233"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label className="muted" style={{ fontSize: '0.78rem', display: 'block', marginBottom: '4px' }}>
                    Profil URL (slug)
                  </label>
                  <input
                    type="text"
                    value={profile.slug}
                    onChange={(e) => setProfile({ ...profile, slug: e.target.value })}
                    placeholder="yayınlanınca otomatik üretilir"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label className="muted" style={{ fontSize: '0.78rem', display: 'block', marginBottom: '4px' }}>
                    Üyelik Paketi
                  </label>
                  <select
                    value={profile.membership_tier}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        membership_tier: e.target.value as 'none' | 'basic' | 'premium',
                      })
                    }
                    style={{ width: '100%' }}
                  >
                    {Object.entries(MEMBERSHIP_LABELS).map(([k, l]) => (
                      <option key={k} value={k}>{l}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={profile.show_phone}
                      onChange={(e) => setProfile({ ...profile, show_phone: e.target.checked })}
                    />
                    Telefonu dizinde göster
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={profile.show_email}
                      onChange={(e) => setProfile({ ...profile, show_email: e.target.checked })}
                    />
                    E-postayı dizinde göster
                  </label>
                </div>
              </div>

              {/* Ek hizmet bölgeleri (kapsam üyelik paketine bağlı) */}
              <div>
                {(() => {
                  const limit = REGION_LIMITS[profile.membership_tier] ?? 1
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin size={14} className="muted" /> Ek Hizmet Bölgeleri ({profile.service_regions.length}/{limit})
                        </span>
                        {profile.service_regions.length < limit && (
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            onClick={() => setProfile({ ...profile, service_regions: [...profile.service_regions, { city: '', district: '' }] })}
                          >
                            + Bölge
                          </button>
                        )}
                      </div>
                      <p className="muted" style={{ fontSize: '0.72rem', marginBottom: '6px' }}>
                        Ana konum hariç. Kapsam üyelik paketine bağlı (Standart 1 · Temel 3 · Üst 10).
                      </p>
                      {profile.service_regions.length === 0 ? (
                        <p className="muted" style={{ fontSize: '0.8rem' }}>Ek bölge eklenmemiş.</p>
                      ) : (
                        <div style={{ display: 'grid', gap: '6px' }}>
                          {profile.service_regions.map((r, idx) => (
                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '6px', alignItems: 'center' }}>
                              <input
                                type="text"
                                value={r.city}
                                placeholder="İl"
                                onChange={(e) => setProfile({ ...profile, service_regions: profile.service_regions.map((x, i) => i === idx ? { ...x, city: e.target.value } : x) })}
                              />
                              <input
                                type="text"
                                value={r.district ?? ''}
                                placeholder="İlçe (opsiyonel)"
                                onChange={(e) => setProfile({ ...profile, service_regions: profile.service_regions.map((x, i) => i === idx ? { ...x, district: e.target.value } : x) })}
                              />
                              <button type="button" className="btn btn--secondary btn--icon btn--sm" title="Kaldır"
                                onClick={() => setProfile({ ...profile, service_regions: profile.service_regions.filter((_, i) => i !== idx) })}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>

              {/* Belgeler */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} className="muted" /> Doğrulama Belgeleri ({profile.documents.length})
                  </span>
                  <label className="btn btn--secondary btn--sm" style={{ cursor: 'pointer' }}>
                    <Upload size={13} /> {uploadingDoc ? '...' : 'Belge Ekle'}
                    <input type="file" accept="image/*,application/pdf" multiple hidden disabled={uploadingDoc} onChange={handleDocUpload} />
                  </label>
                </div>
                {profile.documents.length === 0 ? (
                  <p className="muted" style={{ fontSize: '0.8rem' }}>Henüz belge yüklenmemiş. Başvuru sahibi yüklemiş olabilir ya da buradan ekleyebilirsiniz.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '6px' }}>
                    {profile.documents.map((doc, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-primary)' }}>
                        <a href={doc.url} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <FileText size={13} /> {doc.name || doc.url.split('/').pop()}
                        </a>
                        <select
                          value={doc.type}
                          onChange={(e) => setDocType(idx, e.target.value)}
                          style={{ width: 'auto', minWidth: 130, fontSize: '0.78rem' }}
                        >
                          {Object.entries(DOC_TYPE_LABELS).map(([k, l]) => (
                            <option key={k} value={k}>{l}</option>
                          ))}
                        </select>
                        <button className="btn btn--secondary btn--icon btn--sm" title="Kaldır" onClick={() => removeDoc(idx)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  className="btn btn--secondary"
                  onClick={saveProfile}
                  disabled={profileMutation.isPending}
                >
                  Profili Kaydet
                </button>
                <button
                  className={selected.is_published ? 'btn btn--secondary' : 'btn btn--primary'}
                  onClick={togglePublish}
                  disabled={profileMutation.isPending}
                  title={selected.is_published ? 'Dizinden kaldır' : 'Doğruladıysanız dizinde yayınlayın'}
                >
                  {selected.is_published ? (
                    <>Yayından Kaldır</>
                  ) : (
                    <><BadgeCheck size={14} /> Doğrula & Yayınla</>
                  )}
                </button>
              </div>
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', borderTop: '1px solid var(--border-primary)', paddingTop: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span className="muted">Durum:</span>
                <Badge status={statusMeta(selected.status)} />
                {selected.is_published && (
                  <span className="badge badge--success" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <MessageCircle size={11} /> Dizinde Yayında
                  </span>
                )}
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
