/** Satıcı performans karnesi + analitik tipleri (backend lib/seller-scorecard ile eş). */

export interface SellerScorecard {
  seller_id: string
  overall_score: number
  grade: 'A' | 'B' | 'C' | 'D'
  has_data: boolean
  shipping: {
    score: number
    fulfilled_count: number
    on_time_count: number
    on_time_rate: number
    avg_ship_hours: number | null
    target_days: number
  }
  rating: { score: number; avg: number; count: number }
  returns: { score: number; return_rate: number; returned_order_count: number; total_order_count: number }
  questions: { score: number; answer_rate: number; answered_count: number; total_count: number; avg_answer_hours: number | null }
  cancellation: { score: number; cancel_rate: number; canceled_count: number; total_order_count: number }
}

export interface DailyPoint {
  date: string
  orders: number
  sales: number
  earning: number
}

export interface TopProduct {
  product_id: string
  title: string
  thumbnail: string | null
  quantity: number
  revenue: number
}

export interface SellerAnalytics {
  seller_id: string
  period_days: number
  currency_code: string
  totals: { orders: number; sales: number; earning: number; units: number; avg_order_value: number }
  daily: DailyPoint[]
  top_products: TopProduct[]
  status_breakdown: { pending: number; fulfilled: number; canceled: number }
}

export interface ScorecardComparisonRow {
  seller_id: string
  name: string
  handle: string
  status: 'pending' | 'active' | 'suspended'
  is_house: boolean
  overall_score: number
  grade: 'A' | 'B' | 'C' | 'D'
  has_data: boolean
  on_time_rate: number
  rating_avg: number
  rating_count: number
  return_rate: number
  answer_rate: number
  total_orders: number
}

export function gradeColor(grade: string): string {
  switch (grade) {
    case 'A':
      return 'var(--accent-success)'
    case 'B':
      return 'var(--accent-info)'
    case 'C':
      return 'var(--accent-warning)'
    default:
      return 'var(--accent-danger)'
  }
}

export function scoreColor(score: number): string {
  if (score >= 85) return 'var(--accent-success)'
  if (score >= 70) return 'var(--accent-info)'
  if (score >= 50) return 'var(--accent-warning)'
  return 'var(--accent-danger)'
}

export const pctLabel = (rate: number): string => `%${Math.round((rate || 0) * 100)}`
