import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Store, PackagePlus, FileText, CheckCheck } from 'lucide-react'
import { api } from '../lib/api'
import './NotificationBell.css'

interface NotificationItem {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

interface NotificationsResponse {
  notifications: NotificationItem[]
  count: number
  unread: number
}

const ICONS: Record<string, typeof Bell> = {
  reseller_application: FileText,
  seller_signup: Store,
  product_approval: PackagePlus,
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'az önce'
  if (m < 60) return `${m} dk önce`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} sa önce`
  const d = Math.floor(h / 24)
  return `${d} gün önce`
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: () => api.get<NotificationsResponse>('/admin/notifications', { limit: 15 }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })

  const markRead = useMutation({
    mutationFn: (id?: string) => api.post('/admin/notifications', id ? { id } : {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-notifications'] }),
  })

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const unread = data?.unread ?? 0
  const items = data?.notifications ?? []

  const onItemClick = (n: NotificationItem) => {
    if (!n.read_at) markRead.mutate(n.id)
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  return (
    <div className="notif" ref={wrapRef}>
      <button
        className="header__icon-btn"
        title="Bildirimler"
        aria-label={`Bildirimler${unread ? `, ${unread} okunmamış` : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={18} />
        {unread > 0 && <span className="notif__badge">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="notif__panel" role="menu">
          <div className="notif__head">
            <span>Bildirimler</span>
            {unread > 0 && (
              <button
                className="notif__markall"
                onClick={() => markRead.mutate(undefined)}
                disabled={markRead.isPending}
              >
                <CheckCheck size={14} /> Tümünü okundu işaretle
              </button>
            )}
          </div>

          <div className="notif__list">
            {items.length === 0 ? (
              <div className="notif__empty">Henüz bildirim yok.</div>
            ) : (
              items.map((n) => {
                const Icon = ICONS[n.type] ?? Bell
                return (
                  <button
                    key={n.id}
                    className={`notif__item${n.read_at ? '' : ' notif__item--unread'}`}
                    onClick={() => onItemClick(n)}
                    role="menuitem"
                  >
                    <span className="notif__icon">
                      <Icon size={16} />
                    </span>
                    <span className="notif__text">
                      <span className="notif__title">{n.title}</span>
                      {n.body && <span className="notif__body">{n.body}</span>}
                      <span className="notif__time">{timeAgo(n.created_at)}</span>
                    </span>
                    {!n.read_at && <span className="notif__dot" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
