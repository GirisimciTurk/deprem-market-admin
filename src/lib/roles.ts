/**
 * Basit rol/yetki modeli (UI seviyesi).
 * Rol, Medusa kullanıcısının `metadata.role` alanından okunur (yoksa 'admin').
 *  - admin: tüm modüllere erişim
 *  - staff: hassas modüller (ayarlar, promosyon, müşteriler, bayilik) gizli/kapalı
 *
 * NOT: Bu UI seviyesinde kısıtlama; tam güvenlik için backend'de de role-middleware
 * eklenmeli (bkz. memory). Şu an menü + route guard ile sınırlandırma yapılır.
 */
export type Role = 'admin' | 'staff'

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Yönetici',
  staff: 'Personel',
}

// Yalnızca admin'in erişebildiği yollar
export const ADMIN_ONLY_PATHS = ['/settings', '/promotions', '/customers', '/resellers', '/expert-leads', '/expert-requests', '/havar-requests', '/service-requests', '/sellers', '/seller-scorecards', '/seller-campaigns', '/seller-reviews', '/seller-contracts', '/commission-rules', '/cargo-tariff', '/categories', '/category-attributes', '/brands', '/product-approvals', '/invoices', '/ai-insights', '/conversations']

export function normalizeRole(raw: unknown): Role {
  return raw === 'staff' ? 'staff' : 'admin'
}

export function canAccess(role: Role, path: string): boolean {
  if (role === 'admin') return true
  return !ADMIN_ONLY_PATHS.some((p) => path === p || path.startsWith(p + '/'))
}
