import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  Plane,
  Search,
  Eye,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DoorOpen,
  Package,
  Users,
} from 'lucide-react'
import Header from '../../components/layout/Header'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import Pagination from '../../components/ui/Pagination'
import { LoadingState } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/StateBox'
import { useDebounce } from '../../lib/useDebounce'
import { useToast } from '../../components/ui/toast-context'
import { api } from '../../lib/api'

const LIMIT = 20

interface HavarRequest {
  id: string
  type: 'purchase' | 'rental'
  full_name: string
  email: string
  phone: string
  city: string
  buyer_type: 'individual' | 'family'
  usage: 'cargo' | 'human' | 'both'
  quantity: number
  want_door_mechanism: boolean
  rental_duration: string
  note: string
  status: 'pending' | 'reviewed' | 'contacted' | 'closed'
  created_at: string
}

const TYPE_LABEL: Record<string, string> = { purchase: 'Ön Alım', rental: 'Ön Kiralama' }
const USAGE_LABEL: Record<string, string> = { cargo: 'Kargo', human: 'İnsan', both: 'Kargo + İnsan' }
const BUYER_LABEL: Record<string, string> = { individual: 'Bireysel', family: 'Aile' }
const STATUS_LABEL: Record<string, string> = {
  pending: 'Bekliyor', reviewed: 'İncelendi', contacted: 'İletişime Geçildi', closed: 'Kapandı',
}
const STATUS_VARIANT: Record<string, 'warning' | 'info' | 'success' | 'default'> = {
  pending: 'warning', reviewed: 'info', contacted: 'success', closed: 'default',
}

export default function HavarRequests() {
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<HavarRequest | null>(null)
  const debounced = useDebounce(search)
  const qc = useQueryClient()
  const { notify } = useToast()

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: HavarRequest['status'] }) =>
      api.post(`/admin/havar-requests/${id}`, { status }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['havar-requests'] })
      setSelected(null)
      notify(
        vars.status === 'reviewed'
          ? 'Talep onaylandı, başvuru sahibine bilgilendirme e-postası gönderildi.'
          : 'Talep durumu güncellendi.',
        'success'
      )
    },
    onError: (e: Error) => notify(e.message || 'İşlem başarısız.', 'error'),
  })

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['havar-requests', offset, debounced, typeFilter, statusFilter],
    queryFn: () =>
      api.get<{ requests: HavarRequest[]; count: number }>('/admin/havar-requests', {
        limit: LIMIT,
        offset,
        q: debounced || undefined,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
      }),
    placeholderData: keepPreviousData,
  })

  const requests = data?.requests ?? []
  const count = data?.count ?? 0

  return (
    <div>
      <Header title="HAVAR Talepleri" subtitle="Drone hava aracı ön alım ve ön kiralama talepleri" />

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-tertiary)' }} />
          <input
            className="input"
            style={{ paddingLeft: 36, width: '100%' }}
            placeholder="Ad, e-posta veya şehir ara..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0) }}
          />
        </div>
        <select className="input" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setOffset(0) }}>
          <option value="">Tüm Tipler</option>
          <option value="purchase">Ön Alım</option>
          <option value="rental">Ön Kiralama</option>
        </select>
        <select className="input" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setOffset(0) }}>
          <option value="">Tüm Durumlar</option>
          <option value="pending">Bekliyor</option>
          <option value="reviewed">İncelendi</option>
          <option value="contacted">İletişime Geçildi</option>
          <option value="closed">Kapandı</option>
        </select>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={(error as Error)?.message} onRetry={refetch} />
      ) : requests.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <Plane size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p>Henüz HAVAR talebi yok.</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden', opacity: isFetching ? 0.7 : 1 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Tip</th><th>Ad Soyad</th><th>İletişim</th><th>Kullanım</th>
                <th>Adet</th><th>Kapı Mek.</th><th>Durum</th><th>Tarih</th><th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td><Badge variant={r.type === 'rental' ? 'info' : 'success'}>{TYPE_LABEL[r.type]}</Badge></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.full_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{BUYER_LABEL[r.buyer_type]}{r.city ? ` · ${r.city}` : ''}</div>
                  </td>
                  <td style={{ fontSize: 13 }}>
                    <div>{r.phone || '—'}</div>
                    <div style={{ color: 'var(--text-tertiary)' }}>{r.email}</div>
                  </td>
                  <td style={{ fontSize: 13 }}>{USAGE_LABEL[r.usage]}{r.type === 'rental' && r.rental_duration ? ` · ${r.rental_duration}` : ''}</td>
                  <td>{r.quantity}</td>
                  <td>{r.want_door_mechanism ? <Badge variant="warning">Evet</Badge> : '—'}</td>
                  <td><Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge></td>
                  <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{new Date(r.created_at).toLocaleDateString('tr-TR')}</td>
                  <td>
                    <button className="btn btn--ghost btn--sm" onClick={() => setSelected(r)} title="Detay">
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination offset={offset} limit={LIMIT} count={count} onChange={setOffset} />

      {selected && (
        <Modal title={`HAVAR ${TYPE_LABEL[selected.type]} Talebi`} onClose={() => setSelected(null)} size="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Row icon={<Users size={15} />} label="Talep Sahibi" value={`${selected.full_name} (${BUYER_LABEL[selected.buyer_type]})`} />
            <Row icon={<Mail size={15} />} label="E-posta" value={selected.email} />
            <Row icon={<Phone size={15} />} label="Telefon" value={selected.phone || '—'} />
            <Row icon={<MapPin size={15} />} label="Şehir" value={selected.city || '—'} />
            <Row icon={<Package size={15} />} label="Kullanım / Adet" value={`${USAGE_LABEL[selected.usage]} · ${selected.quantity} adet`} />
            {selected.type === 'rental' && (
              <Row icon={<Calendar size={15} />} label="Kiralama Süresi" value={selected.rental_duration || '—'} />
            )}
            <Row icon={<DoorOpen size={15} />} label="Apartman Kapı Mekanizması" value={selected.want_door_mechanism ? 'İSTENİYOR (bayi montaj hizmeti)' : 'Hayır'} />
            {selected.note && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>Not</div>
                <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{selected.note}</div>
              </div>
            )}
            <Row icon={<Calendar size={15} />} label="Tarih" value={new Date(selected.created_at).toLocaleString('tr-TR')} />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--border-primary)', paddingTop: 14, marginTop: 4 }}>
              <button
                className="btn btn--primary btn--sm"
                disabled={statusMut.isPending}
                onClick={() => statusMut.mutate({ id: selected.id, status: 'reviewed' })}
                title="Talebi onayla ve başvuru sahibine 'en yakın zamanda iletişime geçilecek' e-postası gönder"
              >
                ✓ Onayla & E-posta Gönder
              </button>
              <button className="btn btn--ghost btn--sm" disabled={statusMut.isPending}
                onClick={() => statusMut.mutate({ id: selected.id, status: 'contacted' })}>
                İletişime Geçildi
              </button>
              <button className="btn btn--ghost btn--sm" disabled={statusMut.isPending}
                onClick={() => statusMut.mutate({ id: selected.id, status: 'closed' })}>
                Kapat
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ color: 'var(--accent-primary)', marginTop: 2 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{value}</div>
      </div>
    </div>
  )
}
