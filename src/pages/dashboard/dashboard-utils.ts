import {
  startOfDay,
  subDays,
  startOfMonth,
  subMonths,
  eachHourOfInterval,
  eachDayOfInterval,
  eachMonthOfInterval,
  format as fmtDate,
  formatDistanceToNow,
} from 'date-fns'
import { tr } from 'date-fns/locale'
import { toMajor } from '../../lib/format'

// ─── TYPES ───────────────────────────────────────────────────────────
export type TimeRange = 'today' | '7days' | '30days' | 'all'

export interface OrderRow {
  id: string
  display_id: number
  email?: string
  total?: number
  currency_code?: string
  created_at: string
  payment_status?: string
  fulfillment_status?: string
  status?: string
  shipping_address?: { first_name?: string; last_name?: string } | null
}

export interface ChartPoint {
  name: string
  value: number // major-unit revenue
  orders: number
}

export const COLORS = ['#F08C1A', '#10b981', '#3b82f6', '#f59e0b', '#ef4444']

export const RANGE_LABELS: Record<TimeRange, string> = {
  today: 'Bugün',
  '7days': 'Son 7 Gün',
  '30days': 'Son 30 Gün',
  all: 'Tüm Zamanlar',
}

export const REVENUE_TITLE: Record<TimeRange, string> = {
  today: 'Günlük Ciro',
  '7days': 'Haftalık Ciro',
  '30days': 'Aylık Ciro',
  all: 'Toplam Ciro',
}

// Sipariş kargo durumu → kullanıcı dostu etiket (donut için)
export const FULFILLMENT_LABELS: Record<string, string> = {
  not_fulfilled: 'Hazırlanıyor',
  partially_fulfilled: 'Kısmi Hazır',
  fulfilled: 'Hazırlandı',
  partially_shipped: 'Kısmi Kargo',
  shipped: 'Kargoda',
  partially_delivered: 'Kısmi Teslim',
  delivered: 'Teslim Edildi',
  canceled: 'İptal',
}

export const isPlaced = (o: OrderRow) => o.status !== 'canceled'
export const orderRevenue = (o: OrderRow) => toMajor(o.total)

// ─── Zaman penceresi + bir önceki eşit pencere ──────────────────────
export function getWindow(range: TimeRange, now: Date) {
  if (range === 'today') {
    const start = startOfDay(now)
    return { start, end: now, prevStart: subDays(start, 1), prevEnd: start }
  }
  if (range === '7days') {
    const start = subDays(startOfDay(now), 6)
    return { start, end: now, prevStart: subDays(start, 7), prevEnd: start }
  }
  if (range === '30days') {
    const start = subDays(startOfDay(now), 29)
    return { start, end: now, prevStart: subDays(start, 30), prevEnd: start }
  }
  return { start: new Date(0), end: now, prevStart: null, prevEnd: null }
}

// ─── Grafik kovaları (zaman ekseni) ─────────────────────────────────
export function getBuckets(range: TimeRange, now: Date, firstOrder: Date | null) {
  if (range === 'today') {
    return eachHourOfInterval({ start: startOfDay(now), end: now }).map((d) => ({
      start: d,
      label: fmtDate(d, 'HH:00'),
    }))
  }
  if (range === '7days') {
    return eachDayOfInterval({ start: subDays(startOfDay(now), 6), end: now }).map((d) => ({
      start: d,
      label: fmtDate(d, 'EEE', { locale: tr }),
    }))
  }
  if (range === '30days') {
    return eachDayOfInterval({ start: subDays(startOfDay(now), 29), end: now }).map((d) => ({
      start: d,
      label: fmtDate(d, 'd MMM', { locale: tr }),
    }))
  }
  // all → aylık, ilk siparişten bugüne (en az son 6 ay)
  const start = startOfMonth(firstOrder && firstOrder < subMonths(now, 5) ? firstOrder : subMonths(now, 5))
  return eachMonthOfInterval({ start, end: now }).map((d) => ({
    start: d,
    label: fmtDate(d, 'MMM yy', { locale: tr }),
  }))
}

export function pct(curr: number, prev: number): { change: string; trend: 'up' | 'down' } {
  if (prev <= 0) return { change: curr > 0 ? '+100%' : '—', trend: 'up' }
  const diff = ((curr - prev) / prev) * 100
  return { change: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`, trend: diff >= 0 ? 'up' : 'down' }
}

export function relTime(date: string): string {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: tr })
  } catch {
    return '-'
  }
}
