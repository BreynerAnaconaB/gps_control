
import { useAuth } from '../context/AuthContext'

/**
 * Renders children only if the current user has the given permission.
 * Falls back to `fallback` (default: null) when permission is denied.
 *
 * The backend is the real enforcer — this is UI-only (no security guarantee).
 *
 * Usage:
 *   <RoleGuard action="write" resource="drivers">
 *     <button>Crear conductor</button>
 *   </RoleGuard>
 */
export default function RoleGuard({ action, resource, fallback = null, children }) {
  const { hasPermission } = useAuth()

  if (!hasPermission(action, resource)) {
    return fallback
  }

  return children
}

