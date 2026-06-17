import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

// This Medusa backend stores money amounts in minor units (e.g. 149900 = 1499,00 TRY),
// so all amounts are divided by 100 for display and multiplied back on save.
export const MONEY_DIVISOR = 100

/** Convert a stored (minor-unit) amount to its major-unit display value. */
export function toMajor(amount: number | null | undefined): number {
  return (typeof amount === 'number' ? amount : 0) / MONEY_DIVISOR
}

/** Convert a user-entered major-unit value back to the stored minor-unit amount. */
export function toMinor(value: number): number {
  return Math.round(value * MONEY_DIVISOR)
}

/** Format a stored Medusa money amount (minor units) as Turkish currency. */
export function formatMoney(amount: number | null | undefined, currencyCode = 'try'): string {
  const value = toMajor(amount)
  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: (currencyCode || 'try').toUpperCase(),
      minimumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${value.toFixed(2)} ${(currencyCode || 'TRY').toUpperCase()}`
  }
}

/**
 * Format a major-unit TRY amount as currency.
 *
 * Özel hizmet talebi tutarları (teklif, keşif ücreti, kapora, bakiye) Medusa
 * sipariş tutarlarının aksine TAM LİRA (major) saklanır; `formatMoney`'nin /100
 * bölmesi burada yanlış olur. Bu yardımcı bölme yapmadan biçimlendirir.
 */
export function formatLira(value: number | null | undefined): string {
  const n = typeof value === 'number' ? value : 0
  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    return `${n.toLocaleString('tr-TR')} ₺`
  }
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-'
  try {
    return format(new Date(date), 'd MMM yyyy, HH:mm', { locale: tr })
  } catch {
    return '-'
  }
}

export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return '-'
  try {
    return format(new Date(date), 'd MMM yyyy', { locale: tr })
  } catch {
    return '-'
  }
}
