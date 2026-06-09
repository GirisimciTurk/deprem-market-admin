import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import { normalizeRole, type Role } from './roles'

interface AdminUser {
  id: string
  email: string
  first_name?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * Giriş yapmış admin kullanıcısını ve rolünü döner.
 * Rol, kullanıcı metadata.role'den okunur (yoksa 'admin').
 */
export function useCurrentUser(): { user?: AdminUser; role: Role; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => api.get<{ user: AdminUser }>('/admin/users/me', { fields: 'id,email,first_name,metadata' }),
    staleTime: 5 * 60 * 1000,
  })
  const user = data?.user
  return { user, role: normalizeRole(user?.metadata?.role), isLoading }
}
