import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Users, Send, X, Crown, Heart, Sparkle, AlertTriangle, Moon, UserX } from 'lucide-react'
import { LoadingState } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/StateBox'
import { useToast } from '../../components/ui/toast-context'
import { api } from '../../lib/api'
import { formatMoney } from '../../lib/format'

type SegmentKey = 'champions' | 'loyal' | 'new' | 'at_risk' | 'dormant' | 'lost'

interface SegmentSample { customer_id: string; name: string; email: string | null; orders: number; monetary: number }
interface Segment {
  key: SegmentKey
  label: string
  description: string
  count: number
  total_monetary: number
  avg_orders: number
  samples: SegmentSample[]
}
interface SegmentsResponse { total_customers: number; segments: Segment[] }

const META: Record<SegmentKey, { icon: React.ReactNode; color: string }> = {
  champions: { icon: <Crown size={16} />, color: '#f59e0b' },
  loyal: { icon: <Heart size={16} />, color: '#e11d48' },
  new: { icon: <Sparkle size={16} />, color: '#16a34a' },
  at_risk: { icon: <AlertTriangle size={16} />, color: '#f97316' },
  dormant: { icon: <Moon size={16} />, color: '#64748b' },
  lost: { icon: <UserX size={16} />, color: '#94a3b8' },
}

export default function AnalyticsSegments() {
  const { notify } = useToast()
  const [pushTarget, setPushTarget] = useState<Segment | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['analytics-segments'],
    queryFn: () => api.get<SegmentsResponse>('/admin/analytics/segments'),
  })

  if (isLoading) return <LoadingState label="Segmentler hesaplanıyor..." />
  if (isError) return <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
  if (!data) return null

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Users size={16} /> Müşteri Segmentleri (RFM)
      </h3>
      <p className="muted" style={{ fontSize: '0.78rem', marginBottom: 16 }}>
        {data.total_customers.toLocaleString('tr-TR')} sipariş veren müşteri · gerçek geçmişe göre · push aboneliği olanlara hedefli kampanya gönderebilirsiniz.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {data.segments.map((s) => {
          const m = META[s.key]
          return (
            <div key={s.key} style={{ border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', padding: 16, background: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ color: m.color, display: 'flex' }}>{m.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{s.label}</span>
                <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '1.1rem', color: m.color }}>{s.count.toLocaleString('tr-TR')}</span>
              </div>
              <p className="muted" style={{ fontSize: '0.74rem', margin: '0 0 10px', lineHeight: 1.4 }}>{s.description}</p>
              <div style={{ display: 'flex', gap: 12, fontSize: '0.76rem', marginBottom: 10 }}>
                <span className="muted">Harcama: <strong style={{ color: 'var(--text-primary)' }}>{formatMoney(s.total_monetary, 'try')}</strong></span>
                <span className="muted">Ort. sipariş: <strong style={{ color: 'var(--text-primary)' }}>{s.avg_orders}</strong></span>
              </div>
              {s.samples.length > 0 && (
                <div className="muted" style={{ fontSize: '0.72rem', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  ör: {s.samples.map((x) => x.name).join(', ')}
                </div>
              )}
              <button className="btn btn--secondary btn--sm" disabled={s.count === 0} onClick={() => setPushTarget(s)} style={{ width: '100%', justifyContent: 'center' }}>
                <Send size={13} /> Hedefli Push
              </button>
            </div>
          )
        })}
      </div>

      {pushTarget && <PushModal segment={pushTarget} onClose={() => setPushTarget(null)} notify={notify} />}
    </div>
  )
}

function PushModal({ segment, onClose, notify }: { segment: Segment; onClose: () => void; notify: (m: string, t?: 'success' | 'error') => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('/tr')

  const send = useMutation({
    mutationFn: () => api.post<{ audience: number; total: number; sent: number; message?: string }>(
      '/admin/analytics/segments/push', { segment: segment.key, title: title.trim(), body: body.trim(), url: url.trim() || undefined }),
    onSuccess: (r) => {
      notify(r.sent > 0 ? `${r.sent} cihaza gönderildi (${r.audience} müşteri / ${r.total} abonelik).` : (r.message || 'Bu segmentte push aboneliği olan müşteri yok.'))
      onClose()
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div className="card" style={{ width: 'min(480px, 100%)', padding: 22 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Hedefli Push · {segment.label}</h3>
          <button className="btn btn--ghost btn--icon btn--sm" style={{ marginLeft: 'auto' }} onClick={onClose}><X size={16} /></button>
        </div>
        <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 16 }}>
          {segment.count.toLocaleString('tr-TR')} müşteriye gönderilecek (yalnız push aboneliği olanlara ulaşır).
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Başlık *</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Size özel %15 indirim 🎉" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Mesaj *</span>
            <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={180} placeholder="Sizi özledik! Bu hafta tüm afet hazırlık ürünlerinde indirim." />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Tıklama hedefi (URL)</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/tr veya /tr/store" />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button className="btn btn--secondary" onClick={onClose}>Vazgeç</button>
          <button className="btn btn--primary" disabled={!title.trim() || !body.trim() || send.isPending}
            onClick={() => send.mutate()}>
            <Send size={14} /> {send.isPending ? 'Gönderiliyor...' : 'Gönder'}
          </button>
        </div>
      </div>
    </div>
  )
}
