import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FolderTree, Search, Plus, Pencil, Trash2, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react'
import Header from '../../components/layout/Header'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { LoadingState, Spinner } from '../../components/ui/Spinner'
import { EmptyState, ErrorState } from '../../components/ui/StateBox'
import { useToast } from '../../components/ui/toast-context'
import { useDebounce } from '../../lib/useDebounce'
import { api } from '../../lib/api'

interface Category {
  id: string
  name: string
  handle?: string
  description?: string | null
  is_active?: boolean
  rank?: number
  parent_category_id?: string | null
  parent_category?: { id: string; name: string } | null
}
interface ListResponse {
  product_categories: Category[]
  count: number
}

const FIELDS =
  'id,name,handle,description,is_active,rank,parent_category_id,parent_category.name'

// Kategorileri üstlerine göre gruplar (rank + Türkçe ada göre sıralı).
// Üstü listede olmayanlar kök gibi gösterilir (sayfalama vb. durumunda kaybolmasın).
function buildChildrenMap(categories: Category[]): Map<string | null, Category[]> {
  const ids = new Set(categories.map((c) => c.id))
  const byParent = new Map<string | null, Category[]>()
  for (const c of categories) {
    const p = c.parent_category_id && ids.has(c.parent_category_id) ? c.parent_category_id : null
    byParent.set(p, [...(byParent.get(p) ?? []), c])
  }
  const sortFn = (a: Category, b: Category) =>
    (a.rank ?? 0) - (b.rank ?? 0) || a.name.localeCompare(b.name, 'tr')
  for (const arr of byParent.values()) arr.sort(sortFn)
  return byParent
}

// Kategorileri hiyerarşik sıraya dizer: kökler ve hemen altlarında altları,
// derinlik bilgisiyle. `excludeId` verilirse o kategori VE tüm alt ağacı
// atlanır (düzenlemede kendini/altını üst seçip döngü oluşmasın diye).
function flattenCategoryTree(
  categories: Category[],
  excludeId?: string
): { c: Category; depth: number }[] {
  const byParent = buildChildrenMap(categories)
  const out: { c: Category; depth: number }[] = []
  const walk = (parent: string | null, depth: number) => {
    for (const c of byParent.get(parent) ?? []) {
      if (c.id === excludeId) continue
      out.push({ c, depth })
      walk(c.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

export default function Categories() {
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const debounced = useDebounce(search)

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () =>
      api.get<ListResponse>('/admin/product-categories', { limit: 200, fields: FIELDS }),
  })

  const all = data?.product_categories ?? []
  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase()
    if (!q) return all
    return all.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.handle ?? '').toLowerCase().includes(q)
    )
  }, [all, debounced])

  // Hiyerarşi ağacı: kökler görünür, bir satıra tıklayınca altları açılır.
  // Arama yapılırken ağaç yerine düz eşleşme listesi gösterilir.
  const isSearching = debounced.trim().length > 0
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const childrenOf = useMemo(() => buildChildrenMap(all), [all])
  const treeRows = useMemo(() => {
    const out: { c: Category; depth: number; childCount: number }[] = []
    const walk = (parent: string | null, depth: number) => {
      for (const c of childrenOf.get(parent) ?? []) {
        out.push({ c, depth, childCount: (childrenOf.get(c.id) ?? []).length })
        if (expandedIds.has(c.id)) walk(c.id, depth + 1)
      }
    }
    walk(null, 0)
    return out
  }, [childrenOf, expandedIds])
  const rows = isSearching
    ? filtered.map((c) => ({ c, depth: 0, childCount: 0 }))
    : treeRows
  const toggleExpanded = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-categories'] })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/product-categories/${id}`),
    onSuccess: () => {
      notify('Kategori silindi.')
      invalidate()
      setDeleting(null)
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  // Bir kategorinin "etkin üstü": üstü listede yoksa kök gibi davranır
  // (buildChildrenMap ile aynı mantık — kardeşler doğru gruplansın).
  const idSet = useMemo(() => new Set(all.map((c) => c.id)), [all])
  const effectiveParentId = (c: Category): string | null =>
    c.parent_category_id && idSet.has(c.parent_category_id) ? c.parent_category_id : null

  // Aynı üst kategori altındaki kardeşleri yeniden sıralar. Medusa rank'ı
  // "bu konuma taşı" olarak işler: tek bir kategorinin rank'ını komşusunun
  // rank'ına ayarlamak, aradaki kardeşi (rerankAllSiblings) otomatik kaydırır.
  // Bu yüzden bir komşuyla takas için TEK update yeterli. Değişiklik anında
  // görünsün diye önbellek iyimser güncellenir; hata olursa geri alınır.
  const reorderMutation = useMutation({
    mutationFn: (u: { id: string; rank: number }) =>
      api.post(`/admin/product-categories/${u.id}`, { rank: u.rank }),
    onError: (e: Error) => {
      notify(e.message || 'Sıralama kaydedilemedi.', 'error')
      invalidate()
    },
    onSettled: () => invalidate(),
  })

  const move = (c: Category, dir: -1 | 1) => {
    if (reorderMutation.isPending) return
    const siblings = childrenOf.get(effectiveParentId(c)) ?? []
    const idx = siblings.findIndex((s) => s.id === c.id)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= siblings.length) return

    const neighbor = siblings[target]
    const cRank = c.rank ?? idx
    const nRank = neighbor.rank ?? target
    if (cRank === nRank) return // eşit rank (nadir) — takas görünür değişiklik yapmaz

    // İyimser: iki komşunun rank'ını yer değiştir (Medusa update'te aynısını yapar).
    queryClient.setQueryData<ListResponse>(['admin-categories'], (old) =>
      old
        ? {
            ...old,
            product_categories: old.product_categories.map((pc) =>
              pc.id === c.id
                ? { ...pc, rank: nRank }
                : pc.id === neighbor.id
                  ? { ...pc, rank: cRank }
                  : pc
            ),
          }
        : old
    )
    reorderMutation.mutate({ id: c.id, rank: nRank })
  }

  return (
    <>
      <Header
        title="Kategoriler"
        subtitle="Ürün kategorilerini oluşturun, düzenleyin ve listeleyin"
        sticky
        actions={
          <button className="btn btn--primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> Yeni Kategori
          </button>
        }
      />
      <div style={{ padding: 24 }}>
        <div className="header__search" style={{ maxWidth: 380, marginBottom: 20 }}>
          <Search size={16} />
          <input
            type="text"
            placeholder="Kategori ara..."
            className="header__search-input"
            style={{ width: '100%' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <LoadingState label="Kategoriler yükleniyor..." />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FolderTree size={26} />}
            title="Kategori yok"
            description={
              debounced ? 'Aramaya uygun kategori bulunamadı.' : 'Henüz kategori eklenmemiş. "Yeni Kategori" ile ilkini oluşturun.'
            }
          />
        ) : (
          <div className="card" style={{ overflow: 'hidden', opacity: isFetching ? 0.7 : 1 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th>Üst Kategori</th>
                  <th>Durum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ c, depth, childCount }) => {
                  const isOpen = expandedIds.has(c.id)
                  const canToggle = childCount > 0 && !isSearching
                  const siblings = childrenOf.get(effectiveParentId(c)) ?? []
                  const sibIdx = siblings.findIndex((s) => s.id === c.id)
                  const canReorder = !isSearching && siblings.length > 1
                  return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: depth * 24 }}>
                        {canToggle ? (
                          <button
                            onClick={() => toggleExpanded(c.id)}
                            aria-expanded={isOpen}
                            aria-label={isOpen ? 'Alt kategorileri gizle' : 'Alt kategorileri göster'}
                            style={{ display: 'flex', alignItems: 'center', padding: 2, color: 'var(--text-tertiary)' }}
                          >
                            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        ) : (
                          <span style={{ width: 20, flexShrink: 0 }} />
                        )}
                        <div
                          onClick={canToggle ? () => toggleExpanded(c.id) : undefined}
                          style={{ cursor: canToggle ? 'pointer' : undefined }}
                        >
                          <div style={{ fontWeight: 600 }}>
                            {c.name}
                            {childCount > 0 && (
                              <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 6 }}>
                                ({childCount})
                              </span>
                            )}
                          </div>
                          {c.handle && (
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>/{c.handle}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{c.parent_category?.name || <span style={{ color: 'var(--text-tertiary)' }}>—</span>}</td>
                    <td>
                      <Badge
                        status={
                          c.is_active === false
                            ? { label: 'Pasif', variant: 'neutral' }
                            : { label: 'Aktif', variant: 'success' }
                        }
                      />
                    </td>
                    <td>
                      <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                        {canReorder && (
                          <div style={{ display: 'inline-flex', border: '1px solid var(--border-primary)', borderRadius: 6, overflow: 'hidden' }}>
                            <button
                              type="button"
                              aria-label="Yukarı taşı"
                              title="Yukarı taşı"
                              disabled={sibIdx <= 0 || reorderMutation.isPending}
                              onClick={() => move(c, -1)}
                              style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', color: 'var(--text-secondary)', cursor: sibIdx <= 0 || reorderMutation.isPending ? 'not-allowed' : 'pointer', opacity: sibIdx <= 0 ? 0.35 : 1 }}
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              aria-label="Aşağı taşı"
                              title="Aşağı taşı"
                              disabled={sibIdx >= siblings.length - 1 || reorderMutation.isPending}
                              onClick={() => move(c, 1)}
                              style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', borderLeft: '1px solid var(--border-primary)', color: 'var(--text-secondary)', cursor: sibIdx >= siblings.length - 1 || reorderMutation.isPending ? 'not-allowed' : 'pointer', opacity: sibIdx >= siblings.length - 1 ? 0.35 : 1 }}
                            >
                              <ArrowDown size={14} />
                            </button>
                          </div>
                        )}
                        <button className="btn btn--secondary btn--sm" onClick={() => setEditing(c)}>
                          <Pencil size={14} /> Düzenle
                        </button>
                        <button className="btn btn--danger btn--sm" onClick={() => setDeleting(c)}>
                          <Trash2 size={14} /> Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(creating || editing) && (
        <CategoryFormModal
          category={editing}
          allCategories={all}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            invalidate()
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Kategoriyi Sil"
          message={`"${deleting.name}" kategorisini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
          confirmLabel="Sil"
          danger
          loading={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  )
}

interface FormModalProps {
  category: Category | null
  allCategories: Category[]
  onClose: () => void
  onSaved: () => void
}

function CategoryFormModal({ category, allCategories, onClose, onSaved }: FormModalProps) {
  const { notify } = useToast()
  const isEdit = !!category
  const [name, setName] = useState(category?.name ?? '')
  const [parentId, setParentId] = useState(category?.parent_category_id ?? '')
  const [description, setDescription] = useState(category?.description ?? '')
  const [isActive, setIsActive] = useState(category?.is_active !== false)

  // Üst kategori seçenekleri: hiyerarşik sırada, kendisi + alt ağacı hariç.
  const parentOptions = useMemo(
    () => flattenCategoryTree(allCategories, category?.id),
    [allCategories, category?.id]
  )

  const mutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || undefined,
        is_active: isActive,
        parent_category_id: parentId || null,
      }
      return isEdit
        ? api.post(`/admin/product-categories/${category!.id}`, body)
        : api.post('/admin/product-categories', body)
    },
    onSuccess: () => {
      notify(isEdit ? 'Kategori güncellendi.' : 'Kategori oluşturuldu.', 'success')
      onSaved()
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const submit = () => {
    if (!name.trim()) {
      notify('Kategori adı zorunludur.', 'error')
      return
    }
    mutation.mutate()
  }

  return (
    <Modal
      title={isEdit ? 'Kategoriyi Düzenle' : 'Yeni Kategori'}
      onClose={mutation.isPending ? () => {} : onClose}
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose} disabled={mutation.isPending}>
            Vazgeç
          </button>
          <button className="btn btn--primary" onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending && <Spinner size={14} />}
            {isEdit ? 'Kaydet' : 'Oluştur'}
          </button>
        </>
      }
    >
      <div className="field">
        <label className="field__label">Kategori Adı *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Örn. Deprem Çantaları"
          autoFocus
        />
      </div>
      <div className="field">
        <label className="field__label">Üst Kategori</label>
        <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">Yok (ana kategori)</option>
          {parentOptions.map(({ c, depth }) => (
            <option key={c.id} value={c.id}>
              {' '.repeat(depth * 4) + (depth > 0 ? '└ ' : '') + c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="field__label">Açıklama</label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Opsiyonel kısa açıklama"
        />
      </div>
      <label className="switch-row">
        <div>
          <div className="switch-row__title">Aktif</div>
          <div className="switch-row__hint">Kategori mağazada görünür</div>
        </div>
        <input
          type="checkbox"
          className="switch"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
      </label>
    </Modal>
  )
}
