import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileSignature, Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react'
import Header from '../../components/layout/Header'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import { LoadingState } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/StateBox'
import { useToast } from '../../components/ui/toast-context'
import { api } from '../../lib/api'

interface Contract {
  id: string
  title: string
  version: number
  body: string | null
  pdf_url: string | null
  is_active: boolean
  required: boolean
  created_at: string
}

interface ContractForm {
  title: string
  body: string
  pdf_url: string
  required: boolean
  is_active: boolean
  bump_version: boolean
}

const EMPTY: ContractForm = { title: '', body: '', pdf_url: '', required: true, is_active: true, bump_version: false }

export default function SellerContracts() {
  const { notify } = useToast()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Contract | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<ContractForm>(EMPTY)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['seller-contracts'],
    queryFn: () => api.get<{ contracts: Contract[]; count: number }>('/admin/seller-contracts'),
  })
  const contracts = data?.contracts ?? []

  const save = useMutation({
    mutationFn: (payload: { id?: string; body: Record<string, unknown> }) =>
      payload.id ? api.post(`/admin/seller-contracts/${payload.id}`, payload.body) : api.post('/admin/seller-contracts', payload.body),
    onSuccess: (_r, vars) => {
      notify(vars.id ? 'Sözleşme güncellendi.' : 'Sözleşme oluşturuldu.')
      qc.invalidateQueries({ queryKey: ['seller-contracts'] })
      close()
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const toggle = useMutation({
    mutationFn: (c: Contract) => api.post(`/admin/seller-contracts/${c.id}`, { is_active: !c.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seller-contracts'] }),
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/seller-contracts/${id}`),
    onSuccess: () => { notify('Sözleşme silindi.'); qc.invalidateQueries({ queryKey: ['seller-contracts'] }) },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  function openCreate() { setEditing(null); setForm(EMPTY); setCreating(true) }
  function openEdit(c: Contract) {
    setCreating(false); setEditing(c)
    setForm({ title: c.title, body: c.body ?? '', pdf_url: c.pdf_url ?? '', required: c.required, is_active: c.is_active, bump_version: false })
  }
  function close() { setCreating(false); setEditing(null); setForm(EMPTY) }

  function submit() {
    if (!form.title.trim()) { notify('Başlık zorunludur.', 'error'); return }
    if (!form.body.trim() && !form.pdf_url.trim()) { notify('Metin (HTML) veya PDF bağlantısı girin.', 'error'); return }
    const body: Record<string, unknown> = {
      title: form.title.trim(),
      body: form.body.trim() || null,
      pdf_url: form.pdf_url.trim() || null,
      required: form.required,
      is_active: form.is_active,
    }
    if (editing && form.bump_version) body.bump_version = true
    save.mutate({ id: editing?.id, body })
  }

  const open = creating || !!editing

  return (
    <>
      <Header title="Sözleşmeler" subtitle="Satıcıların panelde dijital olarak onaylayacağı sözleşmeleri yönetin" />

      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <p className="muted" style={{ fontSize: '0.85rem', maxWidth: 620 }}>
            Aktif + zorunlu sözleşmeler, satıcı satışa başlamadan önce panelde onaylanmak zorundadır. Sürümü
            artırırsanız (içerik değişikliği) tüm satıcılar yeni sürümü tekrar onaylar.
          </p>
          <button className="btn btn--primary" onClick={openCreate}><Plus size={16} /> Sözleşme Ekle</button>
        </div>

        {isLoading ? <LoadingState label="Sözleşmeler yükleniyor..." />
          : isError ? <ErrorState onRetry={() => refetch()} />
          : contracts.length === 0 ? (
            <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <FileSignature size={28} style={{ opacity: 0.5, marginBottom: 12 }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Henüz sözleşme yok</h3>
              <p className="muted" style={{ fontSize: '0.88rem' }}>"Sözleşme Ekle" ile ilk satıcı sözleşmenizi oluşturun.</p>
            </div>
          ) : (
            <div className="table-container animate-fadeIn">
              <table>
                <thead><tr><th>Başlık</th><th>Sürüm</th><th>İçerik</th><th>Zorunlu</th><th>Durum</th><th style={{ textAlign: 'right' }}>İşlemler</th></tr></thead>
                <tbody>
                  {contracts.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.title}</td>
                      <td className="muted">v{c.version}</td>
                      <td className="muted" style={{ fontSize: '0.82rem' }}>{c.pdf_url ? 'PDF' : 'HTML metin'}</td>
                      <td>{c.required ? <Badge status={{ label: 'Zorunlu', variant: 'warning' }} /> : <Badge status={{ label: 'Bilgi', variant: 'neutral' }} />}</td>
                      <td><Badge status={c.is_active ? { label: 'Aktif', variant: 'success' } : { label: 'Pasif', variant: 'neutral' }} /></td>
                      <td>
                        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn btn--secondary btn--icon btn--sm" title={c.is_active ? 'Pasifleştir' : 'Aktifleştir'} onClick={() => toggle.mutate(c)}>
                            {c.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button className="btn btn--secondary btn--icon btn--sm" title="Düzenle" onClick={() => openEdit(c)}><Pencil size={14} /></button>
                          <button className="btn btn--danger btn--icon btn--sm" title="Sil" onClick={() => { if (window.confirm('Bu sözleşmeyi silmek istediğinize emin misiniz?')) del.mutate(c.id) }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {open && (
        <Modal
          title={editing ? `Sözleşmeyi Düzenle: ${editing.title}` : 'Yeni Sözleşme'}
          onClose={close}
          size="lg"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn--secondary" onClick={close}>İptal</button>
              <button className="btn btn--primary" onClick={submit} disabled={save.isPending}>{save.isPending ? 'Kaydediliyor...' : 'Kaydet'}</button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Başlık *"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Örn: Satıcı Çerçeve Sözleşmesi" /></Field>
            <Field label="PDF Bağlantısı (opsiyonel)">
              <input value={form.pdf_url} onChange={(e) => setForm({ ...form, pdf_url: e.target.value })} placeholder="https://... (R2/yüklenmiş PDF)" />
            </Field>
            <Field label="Metin (HTML) — PDF yoksa gösterilir">
              <textarea rows={8} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="<h3>Madde 1</h3><p>...</p>" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }} />
            </Field>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                <input type="checkbox" checked={form.required} onChange={(e) => setForm({ ...form, required: e.target.checked })} /> Onayı zorunlu
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Aktif (satıcılara göster)
              </label>
              {editing && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--accent-warning)' }}>
                  <input type="checkbox" checked={form.bump_version} onChange={(e) => setForm({ ...form, bump_version: e.target.checked })} /> Sürümü artır (herkes tekrar onaylasın)
                </label>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
      {children}
    </label>
  )
}
