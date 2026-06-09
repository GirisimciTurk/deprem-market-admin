import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useCurrentUser } from '../lib/useCurrentUser'
import { canAccess } from '../lib/roles'

/**
 * Rol bazlı route koruması (UI seviyesi). Kullanıcının rolü bu yola erişemiyorsa
 * Dashboard'a yönlendirir.
 */
export default function RoleGuard({ children }: { children: ReactNode }) {
  const { role, isLoading } = useCurrentUser()
  const location = useLocation()
  if (isLoading) return null
  if (!canAccess(role, location.pathname)) return <Navigate to="/" replace />
  return <>{children}</>
}
