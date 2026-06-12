import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  FileText,
  Plus,
  Search,
  Pencil,
  Trash2,
  Calendar,
  User,
  Tag,
  Eye,
  Globe,
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

interface BlogTranslation {
  title?: string
  summary?: string
  content?: string
}
interface BlogPost {
  id: string
  title: string
  slug?: string
  category: string
  summary: string
  content: string
  author: string
  status: 'draft' | 'published'
  created_at: string
  translations?: Record<string, BlogTranslation> | null
}


export default function Blog() {
  const { notify } = useToast()
  const qc = useQueryClient()
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const debounced = useDebounce(search)

  // Modals state
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [viewingPost, setViewingPost] = useState<BlogPost | null>(null)

  // Form states
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Deprem Hazırlığı')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [author, setAuthor] = useState('')
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  // İngilizce çeviri (translations.en) — storefront EN dilinde gösterir.
  const [enTitle, setEnTitle] = useState('')
  const [enSummary, setEnSummary] = useState('')
  const [enContent, setEnContent] = useState('')

  // EN alanlarından translations objesi kur; hepsi boşsa null (TR'ye düşülür).
  const buildTranslations = () => {
    const en = { title: enTitle.trim(), summary: enSummary.trim(), content: enContent.trim() }
    return en.title || en.summary || en.content ? { en } : null
  }

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['blog', offset, debounced, statusFilter],
    queryFn: () =>
      api.get<{ posts: BlogPost[]; count: number }>('/admin/blog', {
        limit: LIMIT,
        offset,
        q: debounced || undefined,
        status: statusFilter || undefined,
      }),
    placeholderData: keepPreviousData,
  })
  const filteredPosts = data?.posts ?? []

  const createMutation = useMutation({
    mutationFn: (body: Partial<BlogPost>) => api.post('/admin/blog', body),
    onSuccess: () => {
      notify('Blog yazısı eklendi.')
      qc.invalidateQueries({ queryKey: ['blog'] })
      setIsCreateOpen(false)
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<BlogPost> }) =>
      api.post(`/admin/blog/${id}`, body),
    onSuccess: () => {
      notify('Blog yazısı güncellendi.')
      qc.invalidateQueries({ queryKey: ['blog'] })
      setEditingPost(null)
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/blog/${id}`),
    onSuccess: () => {
      notify('Blog yazısı silindi.')
      qc.invalidateQueries({ queryKey: ['blog'] })
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const busy = createMutation.isPending || updateMutation.isPending

  const handleOpenCreate = () => {
    setTitle(''); setCategory('Deprem Hazırlığı'); setSummary(''); setContent(''); setAuthor('Admin'); setStatus('draft')
    setEnTitle(''); setEnSummary(''); setEnContent('')
    setIsCreateOpen(true)
  }

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) {
      notify('Lütfen gerekli alanları doldurun.', 'error')
      return
    }
    createMutation.mutate({ title, category, summary, content, author, status, translations: buildTranslations() } as any)
  }

  const handleOpenEdit = (post: BlogPost) => {
    setEditingPost(post)
    setTitle(post.title); setCategory(post.category || 'Genel'); setSummary(post.summary || ''); setContent(post.content || ''); setAuthor(post.author || ''); setStatus(post.status)
    const en = post.translations?.en || {}
    setEnTitle(en.title || ''); setEnSummary(en.summary || ''); setEnContent(en.content || '')
  }

  const handleUpdatePost = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPost) return
    if (!title.trim() || !content.trim()) {
      notify('Lütfen gerekli alanları doldurun.', 'error')
      return
    }
    updateMutation.mutate({ id: editingPost.id, body: { title, category, summary, content, author, status, translations: buildTranslations() } as any })
  }

  const handleDeletePost = (id: string) => {
    if (window.confirm('Bu blog yazısını silmek istediğinize emin misiniz?')) {
      deleteMutation.mutate(id)
    }
  }

  // İngilizce alanlar — create + edit formlarında ortak kullanılır.
  const renderEnFields = () => (
    <div className="field" style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 16, marginTop: 4 }}>
      <label className="field__label" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
        <Globe size={14} /> İngilizce (EN) — boş bırakılırsa Türkçe gösterilir
      </label>
      <input type="text" placeholder="Title (EN)" value={enTitle} onChange={(e) => setEnTitle(e.target.value)} style={{ marginBottom: 8 }} />
      <input type="text" placeholder="Summary (EN)" value={enSummary} onChange={(e) => setEnSummary(e.target.value)} style={{ marginBottom: 8 }} />
      <textarea rows={6} placeholder="Content (EN)" value={enContent} onChange={(e) => setEnContent(e.target.value)} />
    </div>
  )

  return (
    <>
      <Header
        title="Blog"
        subtitle="Yazıları oluşturun, düzenleyin ve yayınlayın"
        actions={
          <button className="btn btn--primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Yazı Ekle
          </button>
        }
      />

      <div style={{ padding: '24px' }}>
        {/* Filter bar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div className="header__search" style={{ flex: 1, minWidth: '220px' }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Yazı başlığı, kategori veya yazar ara..."
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
            <option value="published">Yayınlandı</option>
            <option value="draft">Taslak</option>
          </select>
        </div>

        {/* Content list */}
        {isLoading ? (
          <LoadingState label="Yazılar yükleniyor..." />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : filteredPosts.length === 0 ? (
          <EmptyState
            icon={<FileText size={26} />}
            title="Yazı bulunamadı"
            description={search || statusFilter ? 'Filtreye uygun blog yazısı yok.' : 'Henüz hiç yazı eklenmemiş.'}
          />
        ) : (
          <>
          <div className="table-container animate-fadeIn" style={{ opacity: isFetching ? 0.7 : 1 }}>
            <table>
              <thead>
                <tr>
                  <th>Yazı Başlığı</th>
                  <th>Kategori</th>
                  <th>Yazar</th>
                  <th>Durum</th>
                  <th>Tarih</th>
                  <th style={{ textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredPosts.map((post) => (
                  <tr key={post.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600 }}>{post.title}</div>
                        <div className="muted" style={{ fontSize: '0.8rem', marginTop: '2px', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {post.summary}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge--neutral" style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                        <Tag size={10} /> {post.category}
                      </span>
                    </td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem' }}>
                        <User size={13} className="muted" /> {post.author}
                      </span>
                    </td>
                    <td>
                      <Badge status={post.status === 'published' ? { label: 'Yayında', variant: 'success' } : { label: 'Taslak', variant: 'warning' }} />
                    </td>
                    <td className="muted" style={{ fontSize: '0.82rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={13} /> {new Date(post.created_at).toLocaleDateString('tr-TR')}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn btn--secondary btn--icon btn--sm" title="Görüntüle" onClick={() => setViewingPost(post)}>
                          <Eye size={14} />
                        </button>
                        <button className="btn btn--secondary btn--icon btn--sm" title="Düzenle" onClick={() => handleOpenEdit(post)}>
                          <Pencil size={14} />
                        </button>
                        <button className="btn btn--danger btn--icon btn--sm" title="Sil" onClick={() => handleDeletePost(post.id)}>
                          <Trash2 size={14} />
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

      {/* View Modal */}
      {viewingPost && (
        <Modal title={viewingPost.title} onClose={() => setViewingPost(null)} size="lg">
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }} className="muted">
              <User size={14} /> <strong>Yazar:</strong> {viewingPost.author}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }} className="muted">
              <Calendar size={14} /> <strong>Tarih:</strong> {new Date(viewingPost.created_at).toLocaleDateString('tr-TR')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }} className="muted">
              <Tag size={14} /> <strong>Kategori:</strong> {viewingPost.category}
            </div>
            <div>
              <Badge status={viewingPost.status === 'published' ? { label: 'Yayında', variant: 'success' } : { label: 'Taslak', variant: 'warning' }} />
            </div>
          </div>
          <div>
            <h4 style={{ fontWeight: 600, marginBottom: '8px' }}>Özet</h4>
            <p style={{ color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', fontStyle: 'italic' }}>
              {viewingPost.summary}
            </p>
            <h4 style={{ fontWeight: 600, marginBottom: '8px' }}>İçerik</h4>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7', color: 'var(--text-primary)' }}>
              {viewingPost.content}
            </div>
          </div>
        </Modal>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <Modal title="Yeni Blog Yazısı Ekle" onClose={() => setIsCreateOpen(false)} size="lg">
          <form onSubmit={handleCreatePost}>
            <div className="field">
              <label className="field__label">Yazı Başlığı <span style={{ color: 'var(--accent-danger)' }}>*</span></label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Başlık girin..."
              />
            </div>

            <div className="settings-form-row settings-form-row-2col">
              <div className="field">
                <label className="field__label">Kategori</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="Deprem Hazırlığı">Deprem Hazırlığı</option>
                  <option value="İlk Yardım">İlk Yardım</option>
                  <option value="Acil Durum Bilgileri">Acil Durum Bilgileri</option>
                  <option value="Genel">Genel</option>
                </select>
              </div>
              <div className="field">
                <label className="field__label">Yazar</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label className="field__label">Özet / Giriş</label>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Yazının kısa bir özetini yazın..."
              />
            </div>

            <div className="field">
              <label className="field__label">Yazı İçeriği <span style={{ color: 'var(--accent-danger)' }}>*</span></label>
              <textarea
                rows={8}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Yazı içeriğini detaylı olarak buraya girin..."
              />
            </div>

            <div className="field">
              <label className="field__label">Durum</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
                style={{ width: '180px' }}
              >
                <option value="draft">Taslak</option>
                <option value="published">Yayınla</option>
              </select>
            </div>

            {renderEnFields()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', borderTop: '1px solid var(--border-primary)', paddingTop: '16px' }}>
              <button type="button" className="btn btn--secondary" onClick={() => setIsCreateOpen(false)}>
                İptal
              </button>
              <button type="submit" className="btn btn--primary" disabled={busy}>
                Yazıyı Ekle
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editingPost && (
        <Modal title="Yazıyı Düzenle" onClose={() => setEditingPost(null)} size="lg">
          <form onSubmit={handleUpdatePost}>
            <div className="field">
              <label className="field__label">Yazı Başlığı <span style={{ color: 'var(--accent-danger)' }}>*</span></label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="settings-form-row settings-form-row-2col">
              <div className="field">
                <label className="field__label">Kategori</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="Deprem Hazırlığı">Deprem Hazırlığı</option>
                  <option value="İlk Yardım">İlk Yardım</option>
                  <option value="Acil Durum Bilgileri">Acil Durum Bilgileri</option>
                  <option value="Genel">Genel</option>
                </select>
              </div>
              <div className="field">
                <label className="field__label">Yazar</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label className="field__label">Özet / Giriş</label>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>

            <div className="field">
              <label className="field__label">Yazı İçeriği <span style={{ color: 'var(--accent-danger)' }}>*</span></label>
              <textarea
                rows={8}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>

            <div className="field">
              <label className="field__label">Durum</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
                style={{ width: '180px' }}
              >
                <option value="draft">Taslak</option>
                <option value="published">Yayınla</option>
              </select>
            </div>

            {renderEnFields()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', borderTop: '1px solid var(--border-primary)', paddingTop: '16px' }}>
              <button type="button" className="btn btn--secondary" onClick={() => setEditingPost(null)}>
                İptal
              </button>
              <button type="submit" className="btn btn--primary" disabled={busy}>
                Kaydet
              </button>
            </div>
          </form>
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
