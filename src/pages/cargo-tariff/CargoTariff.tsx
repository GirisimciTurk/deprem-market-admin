import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Truck, Save, Trash2, Plus, Info } from 'lucide-react'
import Header from '../../components/layout/Header'
import { LoadingState } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/StateBox'
import { useToast } from '../../components/ui/toast-context'
import { api } from '../../lib/api'
import { toMinor, toMajor } from '../../lib/format'

interface Tier {
  max_desi: number
  fee: number // kuruş
}
interface Tariff {
  id: string
  tiers: Tier[]
  per_extra_fee: number // kuruş
}

// Düzenleme satırı (₺ string).
interface TierRow {
  max_desi: string
  fee: string // ₺
}

export default function CargoTariff() {
  const qc = useQueryClient()
  const { notify } = useToast()
  const [rows, setRows] = useState<TierRow[]>([])
  const [perExtra, setPerExtra] = useState('') // ₺

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['cargo-tariff'],
    queryFn: () => api.get<{ tariff: Tariff }>('/admin/cargo-tariff'),
  })

  useEffect(() => {
    if (data?.tariff) {
      setRows(
        (data.tariff.tiers ?? []).map((t) => ({
          max_desi: String(t.max_desi),
          fee: String(toMajor(t.fee)),
        }))
      )
      setPerExtra(String(toMajor(data.tariff.per_extra_fee ?? 0)))
    }
  }, [data])

  const saveM = useMutation({
    mutationFn: () => {
      const tiers = rows
        .map((r) => ({
          max_desi: Math.round(Number(r.max_desi)),
          fee: toMinor(Number(String(r.fee).replace(',', '.'))),
        }))
        .filter((t) => Number.isFinite(t.max_desi) && t.max_desi > 0 && Number.isFinite(t.fee) && t.fee >= 0)
        .sort((a, b) => a.max_desi - b.max_desi)
      return api.put('/admin/cargo-tariff', {
        tiers,
        per_extra_fee: toMinor(Number(String(perExtra).replace(',', '.')) || 0),
      })
    },
    onSuccess: () => {
      notify('Kargo tarifesi kaydedildi.')
      qc.invalidateQueries({ queryKey: ['cargo-tariff'] })
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  if (isLoading) return <LoadingState label="Tarife yükleniyor..." />
  if (isError) return <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />

  const setRow = (i: number, patch: Partial<TierRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const addRow = () => setRows((rs) => [...rs, { max_desi: '', fee: '' }])
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i))

  const valid = rows.length > 0 && rows.every((r) => Number(r.max_desi) > 0 && Number(String(r.fee).replace(',', '.')) >= 0)

  return (
    <>
      <Header title="Kargo Tarifesi" subtitle="Desi bazlı kargo ücreti — satıcı hakedişinden kesilir" />
      <div style={{ padding: 24, maxWidth: 720 }}>
        <div className="card" style={{ display: 'flex', gap: 10, padding: '12px 16px', marginBottom: 16, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          <Info size={18} style={{ color: 'var(--accent-info)', flexShrink: 0 }} />
          <span>
            Bir gönderinin <strong>desi</strong>'sine (≈ ağırlık kg, yukarı yuvarlanır) göre kargo
            ücreti bulunur ve <strong>satıcının hakedişinden düşülür</strong> (Trendyol modeli).
            Kademeler artan sıralı; desi, ilk uyan kademenin ücretini alır. Son kademeyi aşarsa
            son ücret + (aşan desi × ek ücret).
          </span>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Desi (≤)</th>
                <th style={{ textAlign: 'left' }}>Ücret (₺)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ paddingRight: 10 }}>
                    <input type="number" min={1} step={1} value={r.max_desi} onChange={(e) => setRow(i, { max_desi: e.target.value })} placeholder="1" />
                  </td>
                  <td style={{ paddingRight: 10 }}>
                    <input type="text" inputMode="decimal" value={r.fee} onChange={(e) => setRow(i, { fee: e.target.value })} placeholder="50" />
                  </td>
                  <td style={{ width: 44 }}>
                    <button className="btn btn--icon btn--ghost" onClick={() => removeRow(i)} title="Kademeyi sil" disabled={rows.length <= 1}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button className="btn btn--secondary btn--sm" onClick={addRow} style={{ marginTop: 12 }}>
            <Plus size={14} /> Kademe Ekle
          </button>

          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Son kademeyi aşan her desi için ek ücret (₺):</label>
            <input type="text" inputMode="decimal" value={perExtra} onChange={(e) => setPerExtra(e.target.value)} placeholder="12" style={{ width: 120 }} />
          </div>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn--primary" onClick={() => saveM.mutate()} disabled={!valid || saveM.isPending}>
              <Save size={16} /> {saveM.isPending ? 'Kaydediliyor...' : 'Tarifeyi Kaydet'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
          <Truck size={15} /> Kargo firması: <strong>Yurtiçi Kargo</strong> (manuel mod). Gerçek API entegrasyonu bağlandığında ücretler otomatik hesaplanabilir.
        </div>
      </div>
    </>
  )
}
