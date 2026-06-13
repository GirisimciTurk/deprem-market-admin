type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

interface StatusMeta {
  label: string
  variant: BadgeVariant
}

const ORDER_STATUS: Record<string, StatusMeta> = {
  pending: { label: 'Beklemede', variant: 'warning' },
  completed: { label: 'Tamamlandı', variant: 'success' },
  archived: { label: 'Arşivlendi', variant: 'neutral' },
  canceled: { label: 'İptal Edildi', variant: 'danger' },
  requires_action: { label: 'Aksiyon Gerekli', variant: 'info' },
  draft: { label: 'Taslak', variant: 'neutral' },
}

const PAYMENT_STATUS: Record<string, StatusMeta> = {
  not_paid: { label: 'Ödenmedi', variant: 'neutral' },
  awaiting: { label: 'Bekliyor', variant: 'warning' },
  authorized: { label: 'Yetkilendirildi', variant: 'info' },
  partially_authorized: { label: 'Kısmi Yetki', variant: 'info' },
  captured: { label: 'Tahsil Edildi', variant: 'success' },
  partially_captured: { label: 'Kısmi Tahsil', variant: 'info' },
  refunded: { label: 'İade Edildi', variant: 'neutral' },
  partially_refunded: { label: 'Kısmi İade', variant: 'info' },
  canceled: { label: 'İptal', variant: 'danger' },
  requires_action: { label: 'Aksiyon Gerekli', variant: 'warning' },
}

const FULFILLMENT_STATUS: Record<string, StatusMeta> = {
  not_fulfilled: { label: 'Hazırlanmadı', variant: 'neutral' },
  partially_fulfilled: { label: 'Kısmi Hazır', variant: 'info' },
  fulfilled: { label: 'Hazırlandı', variant: 'info' },
  partially_shipped: { label: 'Kısmi Kargo', variant: 'info' },
  shipped: { label: 'Kargoda', variant: 'success' },
  partially_delivered: { label: 'Kısmi Teslim', variant: 'info' },
  delivered: { label: 'Teslim Edildi', variant: 'success' },
  canceled: { label: 'İptal', variant: 'danger' },
}

const PRODUCT_STATUS: Record<string, StatusMeta> = {
  published: { label: 'Yayında', variant: 'success' },
  draft: { label: 'Taslak', variant: 'neutral' },
  proposed: { label: 'Önerildi', variant: 'warning' },
  rejected: { label: 'Reddedildi', variant: 'danger' },
}

const SELLER_REVIEW_STATUS: Record<string, StatusMeta> = {
  pending: { label: 'Onay Bekliyor', variant: 'warning' },
  approved: { label: 'Yayında', variant: 'success' },
  spam: { label: 'Spam', variant: 'danger' },
}

const RETURN_STATUS: Record<string, StatusMeta> = {
  requested: { label: 'Talep Edildi', variant: 'warning' },
  received: { label: 'Teslim Alındı', variant: 'success' },
  partially_received: { label: 'Kısmi Teslim Alındı', variant: 'info' },
  canceled: { label: 'İptal', variant: 'danger' },
}

function lookup(map: Record<string, StatusMeta>, key?: string): StatusMeta {
  if (!key) return { label: '-', variant: 'neutral' }
  return map[key] ?? { label: key, variant: 'neutral' }
}

export const orderStatus = (s?: string) => lookup(ORDER_STATUS, s)
export const paymentStatus = (s?: string) => lookup(PAYMENT_STATUS, s)
export const fulfillmentStatus = (s?: string) => lookup(FULFILLMENT_STATUS, s)
export const productStatus = (s?: string) => lookup(PRODUCT_STATUS, s)
export const returnStatus = (s?: string) => lookup(RETURN_STATUS, s)
export const sellerReviewStatus = (s?: string) => lookup(SELLER_REVIEW_STATUS, s)

export type { BadgeVariant, StatusMeta }
