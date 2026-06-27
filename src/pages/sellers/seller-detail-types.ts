/** Satıcı detay ekranı (SellerDetail) ve sekmelerinin paylaştığı veri tipleri. */

export type SellerStatus = 'pending' | 'active' | 'suspended'
export type CarrierCode = 'yurtici' | 'mng' | 'ptt'

export interface Seller {
  id: string
  handle: string
  name: string
  legal_name: string | null
  email: string | null
  phone: string | null
  description: string | null
  logo: string | null
  status: SellerStatus
  commission_rate: number
  tax_number: string | null
  iban: string | null
  account_holder: string | null
  default_carrier: CarrierCode | null
  is_house: boolean
  is_featured?: boolean
  rating_sum: number
  rating_count: number
  created_at: string
}

export interface SellerProduct {
  id: string
  title: string
  handle: string
  status: string
  thumbnail: string | null
  created_at: string
}

export interface SellerReturnRow {
  id: string
  display_id: string | null
  customer_email: string | null
  currency_code: string
  status: 'requested' | 'received'
  reason: string | null
  returned_subtotal: number
  returned_earning: number
  created_at: string
}

export interface SellerDetailResponse {
  seller: Seller
  has_login: boolean
  product_stats: { total: number; published: number; proposed: number; rejected: number }
  order_stats: {
    count: number
    fulfilled_count: number
    pending_ship_count: number
    gross: number
    commission: number
    earning_net: number
  }
  payout: {
    currency_code: string
    pending_balance: number
    eligible_balance: number
    paid_total: number
    total_returned: number
  }
  return_stats: { count: number; requested_count: number; returned_subtotal: number }
  review_stats: { rating_avg: number | null; rating_count: number; pending_count: number }
  products: SellerProduct[]
  recent_returns: SellerReturnRow[]
}

export interface SellerOrderRow {
  id: string
  display_id: number
  currency_code: string
  subtotal: number
  commission_amount: number
  seller_earning: number
  item_count: number
  fulfillment_status: string
  payout_status: string
  carrier: string | null
  tracking_number: string | null
  tracking_url: string | null
  created_at: string
}

export interface PayoutSummary {
  currency_code: string
  total_earning: number
  total_commission: number
  total_returned?: number
  pending_balance: number
  eligible_balance: number
  paid_total: number
}

export interface SellerReviewRow {
  id: string
  rating: number
  comment: string
  status: 'pending' | 'approved' | 'spam'
  customer_name: string
  created_at: string
}
