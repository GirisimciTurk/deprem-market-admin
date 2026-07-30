import { describe, expect, it } from 'vitest'
import { sellerOrderStage } from './statusLabels'

/**
 * Backend'deki src/lib/order-stage.ts ile aynı sözleşme. Aynı mantık üç yerde
 * duruyor (backend, satıcı paneli, bu panel); kayma olursa aynı sipariş üç
 * ekranda farklı aşamada görünür. Beklentiler backend'in
 * order-stage.unit.spec.ts dosyasıyla birebir aynı tutulmalı.
 */
describe('sellerOrderStage', () => {
  it('satıcı dokunmadıysa Sipariş Alındı', () => {
    expect(sellerOrderStage({ fulfillment_status: 'pending', preparing_at: null }).label).toBe(
      'Sipariş Alındı'
    )
  })

  it('preparing_at damgalıysa Hazırlanıyor', () => {
    expect(
      sellerOrderStage({ fulfillment_status: 'pending', preparing_at: '2026-07-30T10:00:00.000Z' })
        .label
    ).toBe('Hazırlanıyor')
  })

  it('fulfilled ise Kargoya Verildi — eskiden "Kargolandı" yazıyordu, çizelgeyle uyumsuzdu', () => {
    expect(sellerOrderStage({ fulfillment_status: 'fulfilled' }).label).toBe('Kargoya Verildi')
    expect(sellerOrderStage({ fulfillment_status: 'fulfilled' }).variant).toBe('success')
  })

  it('iptal her şeyi ezer', () => {
    expect(
      sellerOrderStage({ fulfillment_status: 'canceled', preparing_at: '2026-07-30T10:00:00.000Z' })
        .label
    ).toBe('İptal')
  })

  it('alanlar eksikse Sipariş Alındı', () => {
    expect(sellerOrderStage({}).label).toBe('Sipariş Alındı')
  })
})
