import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tag, Search, Plus, Pencil, Trash2, Check } from 'lucide-react'
import Header from '../../components/layout/Header'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { LoadingState, Spinner } from '../../components/ui/Spinner'
import { EmptyState, ErrorState } from '../../components/ui/StateBox'
import { Pagination } from '../../components/ui/Pagination'
import { useToast } from '../../components/ui/toast-context'
import { useDebounce } from '../../lib/useDebounce'
import { api } from '../../lib/api'

interface Brand {
  id: string
  name: string
  slug: string
  status: 'approved' | 'pending'
  logo?: string | null
  requested_by_seller_id?: string | null
}
interface ListResponse {
  brands: Brand[]
  count: number
  offset: number
  limit: number
}

const LIMIT = 50

const statusMeta = (s: string) =>
  s === 'approved'
    ? { label: 'Onaylı', variant: 'success' as const }
    : { label: 'Onay Bekliyor', variant: 'warning' as const }

export default function Brands() {
  const { notify } = useToast()
  const qc = useQueryClient()
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const q = useDebounce(search, 350)
  const [offset, setOffset] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Brand | null>(null)
  const [toDelete, setToDelete] = useState<Brand | null>(null)

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-brands', status, q, offset],
    queryFn: () =>
      api.get<ListResponse>('/admin/brands', { status: status || undefined, q: q || undefined, limit: LIMIT, offset }),
  })
  const brands = data?.brands ?? []
  const count = data?.count ?? 0
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-brands'] })

  const approveMutation = useMutation({
    mutationFn: (b: Brand) => api.post(`/admin/brands/${b.id}`, { status: 'approved' }),
    onSuccess: () => { notify('Marka onaylandı.'); invalidate() },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/brands/${id}`),
    onSuccess: () => { notify('Marka silindi.'); setToDelete(null); invalidate() },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  return (
    <>
      <Header title="Markalar" subtitle="Satıcıların ürünlerinde seçebileceği onaylı markaları yönetin" />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              placeholder="Marka ara…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOffset(0) }}
              style={{ width: '100%', paddingLeft: 32 }}
            />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0) }} style={{ minWidth: 160 }}>
            <option value="">Tüm durumlar</option>
            <option value="approved">Onaylı</option>
            <option value="pending">Onay Bekleyen</option>
          </select>
          <button className="btn btn--primary" onClick={() => { setEditing(null); setModalOpen(true) }}>
            <Plus size={16} /> Yeni Marka
          </button>
        </div>

        {isLoading ? (
          <LoadingState label="Markalar yükleniyor..." />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={refetch} />
        ) : brands.length === 0 ? (
          <EmptyState icon={<Tag size={32} />} title="Marka yok" description="Henüz marka eklenmemiş. 'Yeni Marka' ile ekleyin." />
        ) : (
          <div className="card" style={{ padding: 0, opacity: isFetching ? 0.7 : 1 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Marka</th>
                  <th>Slug</th>
                  <th>Durum</th>
                  <th style={{ textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((b) => (
                  <tr key={b.id}>
                    <td style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {b.logo ? (
                        <img src={b.logo} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
                      ) : (
                        <span style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-tertiary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}><Tag size={14} /></span>
                      )}
                      <strong>{b.name}</strong>
                    </td>
                    <td className="muted">{b.slug}</td>
                    <td><Badge status={statusMeta(b.status)} /></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {b.status === 'pending' && (
                        <button className="btn btn--sm btn--secondary" title="Onayla" onClick={() => approveMutation.mutate(b)} disabled={approveMutation.isPending} style={{ marginRight: 6 }}>
                          <Check size={14} /> Onayla
                        </button>
                      )}
                      <button className="btn btn--sm btn--ghost" title="Düzenle" onClick={() => { setEditing(b); setModalOpen(true) }}>
                        <Pencil size={14} />
                      </button>
                      <button className="btn btn--sm btn--ghost" title="Sil" onClick={() => setToDelete(b)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination offset={offset} limit={LIMIT} count={count} onChange={setOffset} />
          </div>
        )}
      </div>

      {modalOpen && (
        <BrandModal
          brand={editing}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); invalidate() }}
        />
      )}
      {toDelete && (
        <ConfirmDialog
          title="Markayı sil"
          message={`"${toDelete.name}" markasını silmek istediğinize emin misiniz? Bu markaya bağlı ürünlerin marka bilgisi boşalır.`}
          confirmLabel="Sil"
          danger
          onConfirm={() => deleteMutation.mutate(toDelete.id)}
          onCancel={() => setToDelete(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </>
  )
}

interface BrandModalProps {
  brand: Brand | null
  onClose: () => void
  onSaved: () => void
}

function BrandModal({ brand, onClose, onSaved }: BrandModalProps) {
  const { notify } = useToast()
  const isEdit = !!brand
  const [name, setName] = useState(brand?.name ?? '')
  const [logo, setLogo] = useState(brand?.logo ?? '')
  const [status, setStatus] = useState<'approved' | 'pending'>(brand?.status ?? 'approved')

  const mutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { name: name.trim(), logo: logo.trim() || null, status }
      return isEdit ? api.post(`/admin/brands/${brand!.id}`, body) : api.post('/admin/brands', body)
    },
    onSuccess: () => { notify(isEdit ? 'Marka güncellendi.' : 'Marka eklendi.'); onSaved() },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const submit = () => {
    if (!name.trim()) { notify('Marka adı zorunludur.', 'error'); return }
    mutation.mutate()
  }

  return (
    <Modal
      title={isEdit ? 'Markayı Düzenle' : 'Yeni Marka'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose} disabled={mutation.isPending}>Vazgeç</button>
          <button className="btn btn--primary" onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending && <Spinner size={14} />} Kaydet
          </button>
        </>
      }
    >
      <div className="field">
        <label className="field__label">Marka Adı *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. DepremTek" autoFocus />
      </div>
      <div className="field">
        <label className="field__label">Logo URL (opsiyonel)</label>
        <input type="url" value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://… logo görseli" />
      </div>
      <div className="field">
        <label className="field__label">Durum</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as 'approved' | 'pending')}>
          <option value="approved">Onaylı (satıcılar seçebilir)</option>
          <option value="pending">Onay Bekliyor</option>
        </select>
      </div>
    </Modal>
  )
}
