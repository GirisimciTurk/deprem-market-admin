import { useState } from 'react'
import { Sparkles, Send } from 'lucide-react'
import Header from '../../components/layout/Header'
import { LoadingState } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/toast-context'
import { api } from '../../lib/api'

const SUGGESTIONS = [
  'Son 30 günde en çok ciro yapan satıcı kim?',
  'En çok iade alan satıcı hangisi?',
  'Kargo performansı en düşük satıcı kim?',
  'Platform geneli son 30 gün özetini ver.',
]

export default function AiInsights() {
  const { notify } = useToast()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)

  const ask = async (q?: string) => {
    const text = (q ?? question).trim()
    if (text.length < 3) return
    setQuestion(text)
    setLoading(true)
    setAnswer('')
    try {
      const r = await api.post<{ answer?: string; disabled?: boolean; error?: string }>(
        '/admin/ai-insights',
        { question: text }
      )
      if (r.answer) setAnswer(r.answer)
      else notify(r.disabled ? 'AI analitiği şu an kapalı.' : r.error || 'Yanıt alınamadı.', 'error')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Yanıt alınamadı.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Header title="AI İçgörüler" subtitle="Pazaryeri verisi hakkında doğal dille soru sorun" />
      <div style={{ padding: 24, maxWidth: 820 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  ask()
                }
              }}
              placeholder="Örn. En çok iade alan satıcı kim?"
              style={{ flex: 1 }}
            />
            <button className="btn btn--primary" onClick={() => ask()} disabled={loading || question.trim().length < 3}>
              <Send size={15} /> {loading ? 'Soruluyor...' : 'Sor'}
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => ask(s)}
                disabled={loading}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {(loading || answer) && (
          <div className="card" style={{ padding: 20, marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontWeight: 600 }}>
              <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} /> Yanıt
            </div>
            {loading ? (
              <LoadingState label="Veriler analiz ediliyor..." />
            ) : (
              <div style={{ whiteSpace: 'pre-line', lineHeight: 1.65, fontSize: '0.92rem' }}>{answer}</div>
            )}
          </div>
        )}

        <p className="muted" style={{ fontSize: '0.76rem', marginTop: 12 }}>
          Yanıtlar yalnızca mevcut pazaryeri verisinden üretilir; önemli kararlardan önce sayıları ilgili sayfadan doğrulayın.
        </p>
      </div>
    </>
  )
}
