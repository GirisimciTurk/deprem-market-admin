import { Truck, Star, RotateCcw, MessageCircleQuestion, XCircle, Package } from 'lucide-react'
import { toReachableImageUrl } from '../lib/image-url'
import { formatMoney } from '../lib/format'
import {
  gradeColor,
  scoreColor,
  pctLabel,
  type SellerScorecard,
  type SellerAnalytics,
} from '../lib/scorecard'

/** Genel skor halkası + harf notu. */
export function ScoreRing({ sc }: { sc: SellerScorecard }) {
  const color = gradeColor(sc.grade)
  return (
    <div
      className="card animate-fadeIn"
      style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 20, flexWrap: 'wrap' }}
    >
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `conic-gradient(${color} ${sc.overall_score * 3.6}deg, var(--border-color) 0deg)`,
        }}
      >
        <div
          style={{
            width: 92,
            height: 92,
            borderRadius: '50%',
            background: 'var(--bg-card)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1 }}>{sc.overall_score}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>/ 100</span>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 800, color }}>{sc.grade} Notu</div>
        <div style={{ fontWeight: 600, marginTop: 2 }}>Genel Performans Puanı</div>
        <p style={{ margin: '8px 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: 560 }}>
          Kargolama hızı (%30), müşteri puanı (%25), iade oranı (%15), soru yanıtlama (%15) ve
          iptal oranı (%15) ağırlıklı hesaplanır.
        </p>
      </div>
    </div>
  )
}

function Metric({
  icon,
  title,
  score,
  primary,
  detail,
}: {
  icon: React.ReactNode
  title: string
  score: number
  primary: string
  detail: string
}) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-secondary)' }}>{icon}</span>
        <span style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1, color: scoreColor(score) }}>
          {score}
        </span>
      </div>
      <div style={{ fontSize: '0.82rem', fontWeight: 600, marginTop: 8 }}>{title}</div>
      <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: 1 }}>{primary}</div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--border-color)', margin: '8px 0 6px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: scoreColor(score), borderRadius: 3, transition: 'width .4s' }} />
      </div>
      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{detail}</div>
    </div>
  )
}

/** 5 metrik kartı grid'i. */
export function MetricGrid({ sc }: { sc: SellerScorecard }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, margin: '16px 0' }}>
      <Metric
        icon={<Truck size={17} />}
        title="Kargolama"
        score={sc.shipping.score}
        primary={`${pctLabel(sc.shipping.on_time_rate)} zamanında`}
        detail={
          sc.shipping.avg_ship_hours != null
            ? `Ort. ${sc.shipping.avg_ship_hours} sa · hedef ${sc.shipping.target_days} gün`
            : `Hedef ${sc.shipping.target_days} gün`
        }
      />
      <Metric
        icon={<Star size={17} />}
        title="Müşteri Puanı"
        score={sc.rating.score}
        primary={sc.rating.count > 0 ? `${sc.rating.avg.toFixed(1)} / 5` : 'Henüz yok'}
        detail={`${sc.rating.count} değerlendirme`}
      />
      <Metric
        icon={<RotateCcw size={17} />}
        title="İade Oranı"
        score={sc.returns.score}
        primary={pctLabel(sc.returns.return_rate)}
        detail={`${sc.returns.returned_order_count} / ${sc.returns.total_order_count} sipariş`}
      />
      <Metric
        icon={<MessageCircleQuestion size={17} />}
        title="Soru Yanıtlama"
        score={sc.questions.score}
        primary={pctLabel(sc.questions.answer_rate)}
        detail={
          sc.questions.avg_answer_hours != null
            ? `${sc.questions.answered_count}/${sc.questions.total_count} · ort. ${sc.questions.avg_answer_hours} sa`
            : `${sc.questions.answered_count}/${sc.questions.total_count} yanıt`
        }
      />
      <Metric
        icon={<XCircle size={17} />}
        title="İptal Oranı"
        score={sc.cancellation.score}
        primary={pctLabel(sc.cancellation.cancel_rate)}
        detail={`${sc.cancellation.canceled_count} iptal`}
      />
    </div>
  )
}

/** Günlük ciro bar grafiği + en çok satanlar tablosu. */
export function AnalyticsView({ an }: { an: SellerAnalytics }) {
  const cur = an.currency_code
  const maxSales = Math.max(1, ...an.daily.map((d) => d.sales))
  const allZero = an.daily.every((d) => d.sales === 0)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Kpi label="Ciro" value={formatMoney(an.totals.sales, cur)} />
        <Kpi label="Net Kazanç" value={formatMoney(an.totals.earning, cur)} />
        <Kpi label="Sipariş" value={String(an.totals.orders)} />
        <Kpi label="Satılan Adet" value={String(an.totals.units)} />
        <Kpi label="Ort. Sipariş Tutarı" value={formatMoney(an.totals.avg_order_value, cur)} />
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Günlük Ciro ({an.period_days} gün)</div>
        {allZero ? (
          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.88rem', padding: '20px 0', textAlign: 'center' }}>
            Bu dönemde satış yok.
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
            {an.daily.map((d) => (
              <div
                key={d.date}
                title={`${d.date} · ${formatMoney(d.sales, cur)} · ${d.orders} sipariş`}
                style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', minWidth: 2 }}
              >
                <div
                  style={{
                    width: '100%',
                    height: `${Math.max(2, (d.sales / maxSales) * 100)}%`,
                    background: 'var(--accent-primary)',
                    borderRadius: '3px 3px 0 0',
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ fontWeight: 600, margin: '8px 0 12px' }}>En Çok Satan Ürünler</div>
      {an.top_products.length === 0 ? (
        <div className="card" style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
          Bu dönemde satılan ürün yok.
        </div>
      ) : (
        <div className="table-container animate-fadeIn">
          <table>
            <thead>
              <tr>
                <th>Ürün</th>
                <th style={{ textAlign: 'right' }}>Adet</th>
                <th style={{ textAlign: 'right' }}>Ciro</th>
              </tr>
            </thead>
            <tbody>
              {an.top_products.map((p) => (
                <tr key={p.product_id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {p.thumbnail ? (
                        <img src={toReachableImageUrl(p.thumbnail)} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 34, height: 34, borderRadius: 6, background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                          <Package size={15} />
                        </div>
                      )}
                      <span>{p.title}</span>
                    </div>
                  </td>
                  <td className="nowrap" style={{ textAlign: 'right', fontWeight: 600 }}>{p.quantity}</td>
                  <td className="nowrap" style={{ textAlign: 'right' }}>{formatMoney(p.revenue, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  )
}
