// Minimal shapes of the Medusa Admin API responses we consume. Only the fields
// the panel actually uses are typed; everything else is left loose on purpose.

export interface Paginated<T> {
  count: number
  offset: number
  limit: number
  [key: string]: T[] | number
}

export interface OrderAddress {
  first_name?: string
  last_name?: string
  address_1?: string
  address_2?: string
  city?: string
  province?: string
  postal_code?: string
  country_code?: string
  phone?: string
  company?: string
}

export interface OrderItem {
  id: string
  title: string
  quantity: number
  unit_price?: number
  thumbnail?: string | null
  variant_title?: string | null
  product_title?: string | null
}

export interface Fulfillment {
  id: string
  provider_id?: string | null
  shipped_at?: string | null
  delivered_at?: string | null
  canceled_at?: string | null
}

export interface Order {
  id: string
  display_id: number
  email?: string
  status?: string
  payment_status?: string
  fulfillment_status?: string
  currency_code?: string
  /** Iade/değişiklik SONRASI kalan tutar (Medusa current_order_total). İade varsa kalemlerden düşük olabilir. */
  total?: number
  /** Sipariş değişiklik/iade ÖNCESİ tutar — kalemlerin orijinal fiyatlarıyla tutarlı. */
  original_total?: number
  summary?: OrderSummary
  created_at?: string
  items?: OrderItem[]
  shipping_address?: OrderAddress | null
  fulfillments?: Fulfillment[]
}

export interface OrderSummary {
  paid_total?: number
  refunded_total?: number
  current_order_total?: number
  original_order_total?: number
}

export interface MoneyAmount {
  id: string
  amount: number
  currency_code: string
}

export interface ProductVariant {
  id: string
  title?: string
  sku?: string | null
  barcode?: string | null
  manage_inventory?: boolean
  inventory_quantity?: number
  prices?: MoneyAmount[]
}

export interface Product {
  id: string
  title: string
  handle?: string
  status?: string
  thumbnail?: string | null
  created_at?: string
  variants?: ProductVariant[]
  description?: string | null
  weight?: number | null
  seller?: { id: string; name: string; handle: string } | null
}

export interface InventoryLevel {
  id: string
  location_id: string
  stocked_quantity: number
  reserved_quantity: number
}

export interface InventoryItem {
  id: string
  sku?: string | null
  location_levels?: InventoryLevel[]
}

export interface StockLocation {
  id: string
  name: string
}

export interface Customer {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  created_at?: string
  orders?: Order[]
}

