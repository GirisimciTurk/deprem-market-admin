import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Percent, Plus, Trash2, Search, Tag, Power } from 'lucide-react'
import Header from '../../components/layout/Header'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import { LoadingState } from '../../components/ui/Spinner'
import { EmptyState, ErrorState } from '../../components/ui/StateBox'
import { useToast } from '../../components/ui/toast-context'
import { useDebounce } from '../../lib/useDebounce'
import { api } from '../../lib/api'
import type { StatusMeta } from '../../lib/statusLabels'

interface ApplicationMethod {
  type?: 'percentage' | 'fixed'
  value?: number
  currency_code?: string
  target_type?: string
}
interface Promotion {
  id: string
  code: string
  status: 'draft' | 'active' | 'inactive'
  is_automatic?: boolean
  application_method?: ApplicationMethod
}

const PROMO_STATUS: Record<string, StatusMeta> = {
  active: { label: 'Aktif', variant: 'success' },
  inactive: { label: 'Pasif', variant: 'neutral' },
  draft: { label: 'Taslak', variant: 'warning' },
}

export default function Promotions() {
  const { notify } = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  // Create form
  const [code, setCode] = useState('')
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage')
  const [value, setValue] = useState('')

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['promotions', debounced],
    queryFn: () =>
      api.get<{ promotions: Promotion[]; count: number }>('/admin/promotions', {
        limit: 100,
        fields: 'id,code,status,is_automatic,*application_method',
        q: debounced || undefined,
      }),
    placeholderData: keepPreviousData,
  })
  const promotions = data?.promotions ?? []

  const createMutation = useMutation({
    mutationFn: () => {
      const num = parseFloat(value)
      const application_method: Record<string, unknown> = {
        type,
        target_type: 'order',
        allocation: 'across',
        value: num,
      }
      if (type === 'fixed') application_method.currency_code = 'try'
      return api.post('/admin/promotions', {
        code: code.trim().toUpperCase(),
        type: 'standard',
        status: 'active',
        application_method,
      })
    },
    onSuccess: () => {
      notify('Promosyon oluşturuldu.')
      qc.invalidateQueries({ queryKey: ['promotions'] })
      setIsCreateOpen(false)
      setCode(''); setValue(''); setType('percentage')
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const toggleMutation = useMutation({
    mutationFn: (p: Promotion) =>
      api.post(`/admin/promotions/${p.id}`, { status: p.status === 'active' ? 'inactive' : 'active' }),
    onSuccess: () => {
      notify('Promosyon durumu güncellendi.')
      qc.invalidateQueries({ queryKey: ['promotions'] })
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/promotions/${id}`),
    onSuccess: () => {
      notify('Promosyon silindi.')
      qc.invalidateQueries({ queryKey: ['promotions'] })
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() || !value || parseFloat(value) <= 0) {
      notify('Kupon kodu ve geçerli bir değer girin.', 'error')
      return
    }
    createMutation.mutate()
  }

  const formatValue = (p: Promotion) => {
    const am = p.application_method
    if (!am) return '-'
    const v = Number(am.value ?? 0)
    return am.type === 'percentage' ? `%${v}` : `${v.toLocaleString('tr-TR')} ${(am.currency_code || 'TRY').toUpperCase()}`
  }

  return (
    <>
      <Header
        title="Promosyonlar & Kuponlar"
        subtitle="İndirim kuponları oluşturun ve yönetin (Medusa Promotions)"
        actions={
          <button className="btn btn--primary" onClick={() => setIsCreateOpen(true)}>
            <Plus size={16} /> Kupon Oluştur
          </button>
        }
      />

      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div className="header__search" style={{ flex: 1, minWidth: '220px' }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Kupon kodu ara..."
              className="header__search-input"
              style={{ width: '100%' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <LoadingState label="Promosyonlar yükleniyor..." />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : promotions.length === 0 ? (
          <EmptyState
            icon={<Percent size={26} />}
            title="Promosyon bulunamadı"
            description={debounced ? 'Aramaya uygun kupon yok.' : 'Henüz kupon oluşturulmamış. "Kupon Oluştur" ile başlayın.'}
          />
        ) : (
          <div className="table-container animate-fadeIn" style={{ opacity: isFetching ? 0.7 : 1 }}>
            <table>
              <thead>
                <tr>
                  <th>Kupon Kodu</th>
                  <th>İndirim</th>
                  <th>Tür</th>
                  <th>Durum</th>
                  <th style={{ textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Tag size={14} className="muted" /> {p.code}
                      </span>
                    </td>
                    <td><strong>{formatValue(p)}</strong></td>
                    <td className="muted">{p.is_automatic ? 'Otomatik' : 'Kod ile'}</td>
                    <td><Badge status={PROMO_STATUS[p.status] || { label: p.status, variant: 'neutral' }} /></td>
                    <td>
                      <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn--secondary btn--icon btn--sm"
                          title={p.status === 'active' ? 'Pasifleştir' : 'Aktifleştir'}
                          disabled={toggleMutation.isPending}
                          onClick={() => toggleMutation.mutate(p)}
                        >
                          <Power size={14} />
                        </button>
                        <button
                          className="btn btn--danger btn--icon btn--sm"
                          title="Sil"
                          disabled={deleteMutation.isPending}
                          onClick={() => { if (window.confirm(`"${p.code}" kuponunu silmek istiyor musunuz?`)) deleteMutation.mutate(p.id) }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isCreateOpen && (
        <Modal title="Yeni Kupon Oluştur" onClose={() => setIsCreateOpen(false)}>
          <form onSubmit={handleCreate}>
            <div className="field">
              <label className="field__label">Kupon Kodu <span style={{ color: 'var(--accent-danger)' }}>*</span></label>
              <input type="text" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="Örn: AFET15" />
            </div>
            <div className="settings-form-row settings-form-row-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label className="field__label">İndirim Türü</label>
                <select value={type} onChange={(e) => setType(e.target.value as 'percentage' | 'fixed')}>
                  <option value="percentage">Yüzde (%)</option>
                  <option value="fixed">Sabit Tutar (₺)</option>
                </select>
              </div>
              <div className="field">
                <label className="field__label">Değer <span style={{ color: 'var(--accent-danger)' }}>*</span></label>
                <input type="number" min="0" step="0.01" required value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === 'percentage' ? '10' : '100'} />
              </div>
            </div>
            <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
              {type === 'percentage' ? 'Sipariş toplamına yüzde indirim uygulanır.' : 'Sipariş toplamından sabit tutar (TRY) düşülür.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', borderTop: '1px solid var(--border-primary)', paddingTop: '16px' }}>
              <button type="button" className="btn btn--secondary" onClick={() => setIsCreateOpen(false)}>İptal</button>
              <button type="submit" className="btn btn--primary" disabled={createMutation.isPending}>Kuponu Oluştur</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
