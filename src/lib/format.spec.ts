import { describe, it, expect } from 'vitest'
import { toMajor, toMinor, formatMoney } from './format'

describe('format util (minor unit / kuruş)', () => {
  it('toMajor kuruşu liraya çevirir', () => {
    expect(toMajor(55000)).toBe(550)
    expect(toMajor(0)).toBe(0)
    expect(toMajor(null)).toBe(0)
    expect(toMajor(undefined)).toBe(0)
  })

  it('toMinor lirayı kuruşa çevirir (yuvarlar)', () => {
    expect(toMinor(550)).toBe(55000)
    expect(toMinor(49.9)).toBe(4990)
    expect(toMinor(10.005)).toBe(1001)
  })

  it('toMajor/toMinor karşılıklı tutarlı', () => {
    expect(toMinor(toMajor(12345))).toBe(12345)
  })

  it('formatMoney TL formatında gösterir', () => {
    const s = formatMoney(55000, 'try')
    expect(s).toContain('550')
    // Türkçe locale: ₺ veya TRY içerir
    expect(/₺|TRY/.test(s)).toBe(true)
  })
})
