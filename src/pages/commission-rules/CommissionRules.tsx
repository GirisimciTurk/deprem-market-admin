import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Percent, Save, Trash2, Info, Calculator } from 'lucide-react'
import Header from '../../components/layout/Header'
import Badge from '../../components/ui/Badge'
import { LoadingState } from '../../components/ui/Spinner'
import { ErrorState, EmptyState } from '../../components/ui/StateBox'
import { useToast } from '../../components/ui/toast-context'
import { api } from '../../lib/api'

interface CommissionRule {
  category_id: string
  category_name: string
  rate: number | null
}

interface RulesResponse {
  rules: CommissionRule[]
  count: number
}

export default function CommissionRules() {
  const { notify } = useToast()
  const qc = useQueryClient()
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['commission-rules'],
    queryFn: () => api.get<RulesResponse>('/admin/commission-rules'),
  })
  const rules = data?.rules ?? []

  const saveMutation = useMutation({
    mutationFn: (rule: CommissionRule & { rate: number }) =>
      api.post<{ rule: CommissionRule }>('/admin/commission-rules', {
        category_id: rule.category_id,
        category_name: rule.category_name,
        rate: rule.rate,
      }),
    onSuccess: () => {
      notify('Komisyon oranı güncellendi.')
      qc.invalidateQueries({ queryKey: ['commission-rules'] })
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (categoryId: string) =>
      api.delete<{ category_id: string; deleted: boolean }>(`/admin/commission-rules/${categoryId}`),
    onSuccess: () => {
      notify('Kategori oranı kaldırıldı (satıcı oranına döndü).')
      qc.invalidateQueries({ queryKey: ['commission-rules'] })
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  function draftValue(rule: CommissionRule): string {
    const draft = drafts[rule.category_id]
    if (draft !== undefined) return draft
    return rule.rate != null ? String(rule.rate) : ''
  }

  function handleSave(rule: CommissionRule) {
    const raw = draftValue(rule).trim()
    if (raw === '') {
      notify('Lütfen bir komisyon oranı girin.', 'error')
      return
    }
    const rate = Number(raw)
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      notify('Komisyon oranı 0 ile 100 arasında olmalıdır.', 'error')
      return
    }
    saveMutation.mutate({ ...rule, rate })
  }

  function handleDelete(rule: CommissionRule) {
    if (window.confirm(`"${rule.category_name}" kategorisinin komisyon oranını kaldırmak istediğinize emin misiniz? Bu kategorideki ürünler satıcının kendi oranına döner.`)) {
      deleteMutation.mutate(rule.category_id)
    }
  }

  return (
    <>
      <Header title="Komisyon Oranları" subtitle="Kategori bazlı komisyon oranlarını belirleyin ve yönetin" />

      <div style={{ padding: '24px' }}>
        {/* Info note */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            marginBottom: '20px',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
        >
          <Info size={18} style={{ flexShrink: 0, marginTop: '1px', color: 'var(--accent-primary)' }} />
          <span>
            Bir kategoriye komisyon oranı belirlerseniz, o kategorideki tüm ürünler için bu oran geçerli olur.
            Oran belirlenmeyen kategorilerde satıcının kendi komisyon oranı kullanılır (ana mağaza her zaman %0).
          </span>
        </div>

        {/* Content */}
        {isLoading ? (
          <LoadingState label="Komisyon oranları yükleniyor..." />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : rules.length === 0 ? (
          <EmptyState
            icon={<Calculator size={26} />}
            title="Kategori bulunamadı"
            description="Henüz komisyon oranı belirlenebilecek bir kategori yok."
          />
        ) : (
          <div className="table-container animate-fadeIn" style={{ opacity: isFetching ? 0.7 : 1 }}>
            <table>
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th>Komisyon Oranı</th>
                  <th style={{ textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => {
                  const pending = saveMutation.isPending || deleteMutation.isPending
                  return (
                    <tr key={rule.category_id}>
                      <td style={{ fontWeight: 600 }}>{rule.category_name}</td>
                      <td>
                        {rule.rate != null ? (
                          <Badge status={{ label: `%${rule.rate}`, variant: 'info' }} />
                        ) : (
                          <span className="muted" style={{ fontSize: '0.85rem' }}>Satıcı oranı</span>
                        )}
                      </td>
                      <td>
                        <div className="row-actions" style={{ justifyContent: 'flex-end', alignItems: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Percent size={13} className="muted" />
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.5}
                              placeholder="Satıcı oranı"
                              value={draftValue(rule)}
                              onChange={(e) =>
                                setDrafts((d) => ({ ...d, [rule.category_id]: e.target.value }))
                              }
                              style={{ width: '110px' }}
                            />
                          </div>
                          <button
                            className="btn btn--secondary btn--sm"
                            style={{ color: 'var(--accent-success)' }}
                            title="Kaydet"
                            disabled={pending}
                            onClick={() => handleSave(rule)}
                          >
                            <Save size={14} /> Kaydet
                          </button>
                          {rule.rate != null && (
                            <button
                              className="btn btn--secondary btn--icon btn--sm"
                              style={{ color: 'var(--accent-danger)' }}
                              title="Kategori oranını kaldır"
                              disabled={pending}
                              onClick={() => handleDelete(rule)}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
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
    </>
  )
}
