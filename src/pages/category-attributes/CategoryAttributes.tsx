import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SlidersHorizontal, Plus, Pencil, Trash2, Info, ListChecks } from 'lucide-react'
import Header from '../../components/layout/Header'
import Modal from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { LoadingState, Spinner } from '../../components/ui/Spinner'
import { EmptyState, ErrorState } from '../../components/ui/StateBox'
import { useToast } from '../../components/ui/toast-context'
import { api } from '../../lib/api'

type AttrType = 'text' | 'number' | 'select' | 'multiselect' | 'boolean'

interface CategoryAttribute {
  id: string
  category_id: string
  key: string
  name: string
  type: AttrType
  options?: string[] | null
  unit?: string | null
  required: boolean
  rank: number
}
interface AttrResponse { attributes: CategoryAttribute[]; count: number }

interface Category {
  id: string
  name: string
  parent_category_id?: string | null
  parent_category?: { id: string; name: string } | null
}
interface CatResponse { product_categories: Category[]; count: number }

const TYPE_LABEL: Record<AttrType, string> = {
  text: 'Metin',
  number: 'Sayı',
  select: 'Tek Seçim',
  multiselect: 'Çoklu Seçim',
  boolean: 'Evet / Hayır',
}

export default function CategoryAttributes() {
  const { notify } = useToast()
  const qc = useQueryClient()
  const [categoryId, setCategoryId] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryAttribute | null>(null)
  const [toDelete, setToDelete] = useState<CategoryAttribute | null>(null)

  // Kategori listesi (tek seviye düz liste; ad yanında üst kategori gösterilir).
  const { data: catData } = useQuery({
    queryKey: ['admin-categories-flat'],
    queryFn: () =>
      api.get<CatResponse>('/admin/product-categories', {
        limit: 500,
        fields: 'id,name,parent_category_id,parent_category.name',
      }),
  })
  const categories = catData?.product_categories ?? []
  const catLabel = (c: Category) => (c.parent_category?.name ? `${c.parent_category.name} › ${c.name}` : c.name)

  const sortedCats = useMemo(
    () => [...categories].sort((a, b) => catLabel(a).localeCompare(catLabel(b), 'tr')),
    [categories]
  )

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-category-attributes', categoryId],
    queryFn: () => api.get<AttrResponse>('/admin/category-attributes', { category_id: categoryId }),
    enabled: !!categoryId,
  })
  const attributes = (data?.attributes ?? []).slice().sort((a, b) => a.rank - b.rank)
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-category-attributes', categoryId] })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/category-attributes/${id}`),
    onSuccess: () => { notify('Özellik silindi.'); setToDelete(null); invalidate() },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  return (
    <>
      <Header title="Kategori Özellikleri" subtitle="Kategoriye özgü ürün özelliklerini tanımlayın (Trendyol tarzı dinamik alanlar)" />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', marginBottom: 18, background: 'var(--bg-tertiary)', borderRadius: 8, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
          <Info size={16} style={{ color: 'var(--accent-primary, #F08C1A)', flexShrink: 0, marginTop: 1 }} />
          <span>
            Bir kategoriye eklenen özellikler, o kategorinin <strong>alt kategorilerinde de</strong> görünür (miras).
            Satıcı bu kategoride ürün eklerken bu alanları doldurur. Zorunlu özellikler boş bırakılırsa ürün onaya gönderilemez.
          </span>
        </div>

        <div className="field" style={{ maxWidth: 460 }}>
          <label className="field__label">Kategori</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Kategori seçin…</option>
            {sortedCats.map((c) => (
              <option key={c.id} value={c.id}>{catLabel(c)}</option>
            ))}
          </select>
        </div>

        {!categoryId ? (
          <EmptyState icon={<SlidersHorizontal size={32} />} title="Kategori seçin" description="Özelliklerini yönetmek için yukarıdan bir kategori seçin." />
        ) : isLoading ? (
          <LoadingState label="Özellikler yükleniyor..." />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={refetch} />
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button className="btn btn--primary" onClick={() => { setEditing(null); setModalOpen(true) }}>
                <Plus size={16} /> Yeni Özellik
              </button>
            </div>
            {attributes.length === 0 ? (
              <EmptyState icon={<ListChecks size={32} />} title="Özellik yok" description="Bu kategoriye doğrudan tanımlı özellik yok. 'Yeni Özellik' ile ekleyin." />
            ) : (
              <div className="card" style={{ padding: 0, opacity: isFetching ? 0.7 : 1 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Sıra</th>
                      <th>Özellik</th>
                      <th>Tip</th>
                      <th>Seçenekler / Birim</th>
                      <th>Zorunlu</th>
                      <th style={{ textAlign: 'right' }}>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attributes.map((a) => (
                      <tr key={a.id}>
                        <td className="muted">{a.rank}</td>
                        <td>
                          <strong>{a.name}</strong>
                          <div className="muted" style={{ fontSize: '0.74rem' }}>{a.key}</div>
                        </td>
                        <td>{TYPE_LABEL[a.type]}</td>
                        <td className="muted" style={{ fontSize: '0.82rem', maxWidth: 320 }}>
                          {a.type === 'select' || a.type === 'multiselect'
                            ? (a.options ?? []).join(', ') || '—'
                            : a.type === 'number'
                            ? (a.unit ? `Birim: ${a.unit}` : '—')
                            : '—'}
                        </td>
                        <td>{a.required ? <span style={{ color: 'var(--accent-danger, #dc2626)', fontWeight: 600 }}>Zorunlu</span> : <span className="muted">Opsiyonel</span>}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button className="btn btn--sm btn--ghost" title="Düzenle" onClick={() => { setEditing(a); setModalOpen(true) }}><Pencil size={14} /></button>
                          <button className="btn btn--sm btn--ghost" title="Sil" onClick={() => setToDelete(a)}><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {modalOpen && categoryId && (
        <AttributeModal
          categoryId={categoryId}
          attribute={editing}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); invalidate() }}
        />
      )}
      {toDelete && (
        <ConfirmDialog
          title="Özelliği sil"
          message={`"${toDelete.name}" özelliğini silmek istediğinize emin misiniz?`}
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

interface AttributeModalProps {
  categoryId: string
  attribute: CategoryAttribute | null
  onClose: () => void
  onSaved: () => void
}

function AttributeModal({ categoryId, attribute, onClose, onSaved }: AttributeModalProps) {
  const { notify } = useToast()
  const isEdit = !!attribute
  const [name, setName] = useState(attribute?.name ?? '')
  const [type, setType] = useState<AttrType>(attribute?.type ?? 'text')
  const [optionsText, setOptionsText] = useState((attribute?.options ?? []).join('\n'))
  const [unit, setUnit] = useState(attribute?.unit ?? '')
  const [required, setRequired] = useState(attribute?.required ?? false)
  const [rank, setRank] = useState(String(attribute?.rank ?? 0))

  const needsOptions = type === 'select' || type === 'multiselect'

  const mutation = useMutation({
    mutationFn: () => {
      const options = needsOptions
        ? optionsText.split('\n').map((s) => s.trim()).filter(Boolean)
        : null
      const body: Record<string, unknown> = {
        name: name.trim(),
        type,
        options,
        unit: type === 'number' ? unit.trim() || null : null,
        required,
        rank: Number(rank) || 0,
      }
      if (isEdit) return api.post(`/admin/category-attributes/${attribute!.id}`, body)
      return api.post('/admin/category-attributes', { category_id: categoryId, ...body })
    },
    onSuccess: () => { notify(isEdit ? 'Özellik güncellendi.' : 'Özellik eklendi.'); onSaved() },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const submit = () => {
    if (!name.trim()) { notify('Özellik adı zorunludur.', 'error'); return }
    if (needsOptions && optionsText.split('\n').map((s) => s.trim()).filter(Boolean).length === 0) {
      notify('Seçim tipinde en az bir seçenek girin.', 'error'); return
    }
    mutation.mutate()
  }

  return (
    <Modal
      title={isEdit ? 'Özelliği Düzenle' : 'Yeni Özellik'}
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
        <label className="field__label">Özellik Adı *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Renk, Beden, Cinsiyet" autoFocus />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="field">
          <label className="field__label">Tip</label>
          <select value={type} onChange={(e) => setType(e.target.value as AttrType)}>
            <option value="text">Metin</option>
            <option value="number">Sayı</option>
            <option value="select">Tek Seçim</option>
            <option value="multiselect">Çoklu Seçim</option>
            <option value="boolean">Evet / Hayır</option>
          </select>
        </div>
        <div className="field">
          <label className="field__label">Sıra</label>
          <input type="number" value={rank} onChange={(e) => setRank(e.target.value)} placeholder="0" />
        </div>
      </div>
      {needsOptions && (
        <div className="field">
          <label className="field__label">Seçenekler (her satıra bir tane)</label>
          <textarea rows={5} value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder={'Siyah\nBeyaz\nKırmızı'} />
        </div>
      )}
      {type === 'number' && (
        <div className="field">
          <label className="field__label">Birim (opsiyonel)</label>
          <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Örn. cm, ay, L" />
        </div>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.9rem', marginTop: 4 }}>
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
        Zorunlu alan (boş bırakılırsa ürün onaya gönderilemez)
      </label>
    </Modal>
  )
}
