import { describe, it, expect } from 'vitest'
import { resolveCarrier, getCarrierName, getTrackingUrl } from './cargo'

describe('cargo util', () => {
  it('aras_kargo provider → Aras Kargo', () => {
    expect(resolveCarrier('aras_kargo').name).toBe('Aras Kargo')
    expect(getCarrierName('aras_kargo')).toBe('Aras Kargo')
  })

  it('manual/bilinmeyen provider → varsayılan (Aras)', () => {
    expect(getCarrierName('manual_manual')).toBe('Aras Kargo')
    expect(getCarrierName(null)).toBe('Aras Kargo')
    expect(getCarrierName(undefined)).toBe('Aras Kargo')
  })

  it('yurtici provider → Yurtiçi Kargo', () => {
    expect(getCarrierName('yurtici_x')).toBe('Yurtiçi Kargo')
  })

  it('getTrackingUrl takip no ile Aras URL üretir', () => {
    const url = getTrackingUrl('ARS123', 'aras_kargo')
    expect(url).toContain('araskargo.com.tr')
    expect(url).toContain('ARS123')
  })

  it('boş takip no → null', () => {
    expect(getTrackingUrl('', 'aras_kargo')).toBeNull()
    expect(getTrackingUrl('   ', 'aras_kargo')).toBeNull()
  })

  it('takip no URL-encode edilir', () => {
    expect(getTrackingUrl('A B/C', 'aras_kargo')).toContain('A%20B%2FC')
  })
})
