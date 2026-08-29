import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

interface Props {
  permission?: string
  anyOf?: string[]
  platformOnly?: boolean
}

export function ProtectedRoute({ permission, anyOf, platformOnly }: Props) {
  const { token, user, hasPermission } = useAuthStore()

  if (!token) {
    return <Navigate to="/login" replace />
  }

  // Platform Admin accounts have no business, so a business-scoped route means
  // nothing to them, and vice versa.
  if (platformOnly && !user?.is_platform_admin) {
    return <Navigate to="/" replace />
  }
  if (user?.is_platform_admin && !platformOnly) {
    return <Navigate to="/platform" replace />
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/" replace />
  }

  if (anyOf && !anyOf.some((p) => hasPermission(p))) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
