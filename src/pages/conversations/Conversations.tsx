import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { MessageSquare, Store, User, Package } from 'lucide-react'
import Header from '../../components/layout/Header'
import Pagination from '../../components/ui/Pagination'
import Modal from '../../components/ui/Modal'
import { LoadingState } from '../../components/ui/Spinner'
import { EmptyState, ErrorState } from '../../components/ui/StateBox'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'

const LIMIT = 20

interface AdminConversation {
  id: string
  seller: { id: string; name: string }
  customer_name: string
  order_display_id?: string | null
  subject?: string | null
  status: string
  last_message_at?: string | null
  last_message_preview?: string | null
  last_sender_type?: 'customer' | 'seller' | null
}

interface ConversationsResponse {
  conversations: AdminConversation[]
  count: number
  offset: number
  limit: number
}

interface ThreadMessage {
  id: string
  sender_type: 'customer' | 'seller'
  body: string
  created_at: string
}
interface ThreadResponse {
  conversation: {
    id: string
    seller: { id: string; name: string }
    customer_name: string
    customer_email?: string | null
    subject?: string | null
    order_display_id?: string | null
    status: string
  }
  messages: ThreadMessage[]
}

export default function Conversations() {
  const [offset, setOffset] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-conversations', offset],
    queryFn: () => api.get<ConversationsResponse>('/admin/conversations', { limit: LIMIT, offset }),
    placeholderData: keepPreviousData,
  })

  const thread = useQuery({
    queryKey: ['admin-conversation', openId],
    queryFn: () => api.get<ThreadResponse>(`/admin/conversations/${openId}/messages`),
    enabled: !!openId,
  })

  const conversations = data?.conversations ?? []

  return (
    <>
      <Header
        title="Mesajlar"
        subtitle="Müşteri ↔ satıcı mesajlaşmalarının gözetimi (salt-okunur)"
      />
      <div style={{ padding: 24 }}>
        {isLoading ? (
          <LoadingState label="Mesajlar yükleniyor..." />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={<MessageSquare size={26} />}
            title="Mesaj yok"
            description="Platformda henüz müşteri-satıcı mesajlaşması yok."
          />
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: isFetching ? 0.6 : 1 }}>
              {conversations.map((c) => (
                <button
                  key={c.id}
                  className="card"
                  style={{ padding: 16, textAlign: 'left', cursor: 'pointer', border: 'none', width: '100%' }}
                  onClick={() => setOpenId(c.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.85rem', fontWeight: 600 }}>
                      <User size={14} /> {c.customer_name}
                    </span>
                    <span className="muted">↔</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.85rem' }}>
                      <Store size={14} /> {c.seller.name}
                    </span>
                    {c.order_display_id && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem' }} className="muted">
                        <Package size={12} /> #{c.order_display_id}
                      </span>
                    )}
                    <span className="muted" style={{ marginLeft: 'auto', fontSize: '0.76rem' }}>
                      {c.last_message_at ? formatDate(c.last_message_at) : ''}
                    </span>
                  </div>
                  {c.subject && <div style={{ fontSize: '0.83rem', fontWeight: 500, marginBottom: 4 }}>{c.subject}</div>}
                  <div className="muted" style={{ fontSize: '0.84rem' }}>
                    {c.last_sender_type === 'seller' ? 'Satıcı: ' : 'Müşteri: '}
                    {c.last_message_preview || '—'}
                  </div>
                </button>
              ))}
            </div>
            <Pagination offset={offset} limit={LIMIT} count={data?.count ?? 0} onChange={setOffset} />
          </>
        )}
      </div>

      {openId && (
        <Modal
          title="Konuşma Geçmişi"
          size="lg"
          onClose={() => setOpenId(null)}
        >
          {thread.isLoading ? (
            <LoadingState label="Yükleniyor..." />
          ) : thread.isError ? (
            <ErrorState message={(thread.error as Error)?.message} onRetry={() => thread.refetch()} />
          ) : (
            <div>
              <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 14 }}>
                {thread.data?.conversation.customer_name}
                {thread.data?.conversation.customer_email ? ` (${thread.data.conversation.customer_email})` : ''}
                {' ↔ '}
                {thread.data?.conversation.seller.name}
                {thread.data?.conversation.subject ? ` · ${thread.data.conversation.subject}` : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '52vh', overflowY: 'auto' }}>
                {(thread.data?.messages ?? []).map((m) => (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: m.sender_type === 'seller' ? 'flex-end' : 'flex-start',
                      maxWidth: '74%',
                      padding: '9px 13px',
                      borderRadius: 12,
                      fontSize: '0.88rem',
                      background: m.sender_type === 'seller' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                      color: m.sender_type === 'seller' ? '#fff' : 'var(--text-primary)',
                      border: m.sender_type === 'seller' ? 'none' : '1px solid var(--border-primary)',
                    }}
                  >
                    <div style={{ fontSize: '0.68rem', opacity: 0.75, marginBottom: 3 }}>
                      {m.sender_type === 'seller' ? 'Satıcı' : 'Müşteri'}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</div>
                    <div style={{ fontSize: '0.66rem', opacity: 0.7, marginTop: 4, textAlign: 'right' }}>
                      {formatDate(m.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
