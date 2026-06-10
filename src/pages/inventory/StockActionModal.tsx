import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, ArrowLeftRight } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/toast-context'
import { api } from '../../lib/api'

interface LevelInfo {
  location_id: string
  stocked_quantity: number
  reserved_quantity: number
}
interface StockLocation {
  id: string
  name: string
}
export interface StockActionRow {
  productTitle: string
  variantTitle: string
  sku: string
  inventoryItemId: string | null
  levels: Record<string, LevelInfo>
}

interface Props {
  row: StockActionRow
  locations: StockLocation[]
  onClose: () => void
}

type Tab = 'count' | 'transfer'

export default function StockActionModal({ row, locations, onClose }: Props) {
  const { notify } = useToast()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('count')

  const firstLevelLoc = Object.keys(row.levels)[0] ?? locations[0]?.id ?? ''
  const [countLoc, setCountLoc] = useState(firstLevelLoc)
  const [counted, setCounted] = useState('')

  const [fromLoc, setFromLoc] = useState(firstLevelLoc)
  const [toLoc, setToLoc] = useState(locations.find((l) => l.id !== firstLevelLoc)?.id ?? '')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')

  const systemQty = row.levels[countLoc]?.stocked_quantity ?? 0
  const fromAvail =
    (row.levels[fromLoc]?.stocked_quantity ?? 0) - (row.levels[fromLoc]?.reserved_quantity ?? 0)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['inventory-products'] })
    qc.invalidateQueries({ queryKey: ['products-dashboard'] })
    qc.invalidateQueries({ queryKey: ['stock-movements'] })
  }

  const countMutation = useMutation({
    mutationFn: () =>
      api.post('/admin/inventory-counts', {
        inventory_item_id: row.inventoryItemId,
        location_id: countLoc,
        counted_quantity: parseInt(counted, 10),
        reason: reason.trim() || undefined,
      }),
    onSuccess: (r: any) => {
      const d = r?.delta ?? 0
      notify(
        d === 0
          ? 'Sayım kaydedildi: sistemle fark yok.'
          : `Sayım kaydedildi: ${d > 0 ? '+' : ''}${d} adet fark düzeltildi.`
      )
      invalidate()
      onClose()
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const transferMutation = useMutation({
    mutationFn: () =>
      api.post('/admin/inventory-transfers', {
        inventory_item_id: row.inventoryItemId,
        from_location_id: fromLoc,
        to_location_id: toLoc,
        quantity: parseInt(qty, 10),
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      notify('Transfer tamamlandı.')
      invalidate()
      onClose()
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const busy = countMutation.isPending || transferMutation.isPending
  const labelStyle = { display: 'block', fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 6 } as const

  const countValid = !Number.isNaN(parseInt(counted, 10)) && parseInt(counted, 10) >= 0
  const transferQty = parseInt(qty, 10)
  const transferValid =
    locations.length >= 2 && fromLoc && toLoc && fromLoc !== toLoc && transferQty > 0 && transferQty <= fromAvail

  return (
    <Modal title="Stok İşlemi" size="md" onClose={onClose}>
      <div style={{ fontSize: '0.875rem', marginBottom: 4 }}>
        <strong>{row.productTitle}</strong>
        {row.variantTitle && <span className="muted"> · {row.variantTitle}</span>}
      </div>
      <div className="muted" style={{ fontSize: '0.78rem', marginBottom: 16 }}>SKU: {row.sku}</div>

      {/* Sekmeler */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <button
          className={`btn btn--sm ${tab === 'count' ? 'btn--primary' : 'btn--secondary'}`}
          onClick={() => setTab('count')}
        >
          <ClipboardCheck size={14} /> Sayım
        </button>
        <button
          className={`btn btn--sm ${tab === 'transfer' ? 'btn--primary' : 'btn--secondary'}`}
          onClick={() => setTab('transfer')}
        >
          <ArrowLeftRight size={14} /> Transfer
        </button>
      </div>

      {tab === 'count' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {locations.length > 1 && (
            <div>
              <label style={labelStyle}>Lokasyon</label>
              <select value={countLoc} onChange={(e) => setCountLoc(e.target.value)} style={{ width: '100%' }}>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span className="muted">Sistemdeki miktar</span>
            <strong>{systemQty} adet</strong>
          </div>
          <div>
            <label style={labelStyle}>Sayılan (fiziksel) miktar</label>
            <input type="number" min={0} value={counted} onChange={(e) => setCounted(e.target.value)}
              placeholder={String(systemQty)} style={{ width: '100%' }} />
            {countValid && parseInt(counted, 10) !== systemQty && (
              <div className="muted" style={{ fontSize: '0.78rem', marginTop: 6 }}>
                Fark: <strong style={{ color: parseInt(counted, 10) > systemQty ? 'var(--success,#16a34a)' : 'var(--danger,#dc2626)' }}>
                  {parseInt(counted, 10) - systemQty > 0 ? '+' : ''}{parseInt(counted, 10) - systemQty} adet
                </strong>
              </div>
            )}
          </div>
          <div>
            <label style={labelStyle}>Not (opsiyonel)</label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="ör. dönem sonu sayımı" style={{ width: '100%' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn--secondary" onClick={onClose}>Vazgeç</button>
            <button className="btn btn--primary" disabled={busy || !countValid} onClick={() => countMutation.mutate()}>
              {busy ? <Spinner size={14} /> : <ClipboardCheck size={15} />} Sayımı Kaydet
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {locations.length < 2 ? (
            <div className="card muted" style={{ fontSize: '0.85rem' }}>
              Transfer için en az 2 stok lokasyonu gerekir. Şu an tek lokasyon var.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Kaynak</label>
                  <select value={fromLoc} onChange={(e) => setFromLoc(e.target.value)} style={{ width: '100%' }}>
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Hedef</label>
                  <select value={toLoc} onChange={(e) => setToLoc(e.target.value)} style={{ width: '100%' }}>
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="muted" style={{ fontSize: '0.78rem' }}>
                Kaynakta taşınabilir: <strong>{fromAvail} adet</strong>
              </div>
              <div>
                <label style={labelStyle}>Miktar</label>
                <input type="number" min={1} max={fromAvail} value={qty} onChange={(e) => setQty(e.target.value)}
                  style={{ width: '100%' }} />
                {fromLoc === toLoc && <div style={{ color: 'var(--danger,#dc2626)', fontSize: '0.78rem', marginTop: 6 }}>Kaynak ve hedef aynı olamaz.</div>}
              </div>
              <div>
                <label style={labelStyle}>Not (opsiyonel)</label>
                <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn btn--secondary" onClick={onClose}>Vazgeç</button>
                <button className="btn btn--primary" disabled={busy || !transferValid} onClick={() => transferMutation.mutate()}>
                  {busy ? <Spinner size={14} /> : <ArrowLeftRight size={15} />} Transfer Et
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
