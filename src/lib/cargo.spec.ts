import { describe, it, expect } from 'vitest'
import { resolveCarrier, getCarrierName, getTrackingUrl } from './cargo'

describe('cargo util', () => {
  it('yurtici_kargo provider → Yurtiçi Kargo', () => {
    expect(resolveCarrier('yurtici_kargo').name).toBe('Yurtiçi Kargo')
    expect(getCarrierName('yurtici_kargo')).toBe('Yurtiçi Kargo')
  })

  it('manual/bilinmeyen provider → varsayılan (Yurtiçi)', () => {
    expect(getCarrierName('manual_manual')).toBe('Yurtiçi Kargo')
    expect(getCarrierName(null)).toBe('Yurtiçi Kargo')
    expect(getCarrierName(undefined)).toBe('Yurtiçi Kargo')
  })

  it('mng provider → MNG Kargo', () => {
    expect(getCarrierName('mng_x')).toBe('MNG Kargo')
  })

  it('getTrackingUrl takip no ile Yurtiçi URL üretir', () => {
    const url = getTrackingUrl('YK123', 'yurtici_kargo')
    expect(url).toContain('yurticikargo.com')
    expect(url).toContain('YK123')
  })

  it('boş takip no → null', () => {
    expect(getTrackingUrl('', 'yurtici_kargo')).toBeNull()
    expect(getTrackingUrl('   ', 'yurtici_kargo')).toBeNull()
  })

  it('takip no URL-encode edilir', () => {
    expect(getTrackingUrl('A B/C', 'yurtici_kargo')).toContain('A%20B%2FC')
  })
})
