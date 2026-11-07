
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import {
  login as apiLogin,
  logout as apiLogout,
  refreshSession,
} from '../services/authService'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true) // true while we check the session on mount

  // On mount: try to restore session from the HttpOnly refresh cookie
  useEffect(() => {
    async function restoreSession() {
      try {
        const data = await refreshSession()
        if (data?.user) {
          setUser(data.user)
          setLoading(false)
          return
        }
      } catch {
        // No valid refresh token o cookie bloqueada por política cross-site
      }

      // Fallback: restaurar sesión guardada para persistir en recargas de página
      try {
        const savedUser = sessionStorage.getItem('auth_user')
        if (savedUser) {
          setUser(JSON.parse(savedUser))
        }
      } catch {}

      setLoading(false)
    }

    restoreSession()
  }, [])

  // Auto-cierre de sesión si la rotación/renovación falla definitivamente
  useEffect(() => {
    function handleSessionExpired() {
      setUser(null)
    }
    window.addEventListener('auth:session-expired', handleSessionExpired)
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired)
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await apiLogin(email, password)
    setUser(data.user)
    return data
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setUser(null)
  }, [])

  // Utility: check if the current user has a given permission.
  // The backend is the authority; this is only for UI hints.
  const hasPermission = useCallback(
    (action, resource) => {
      if (!user) return false
      const role = user.role

      const permMap = {
        admin: [
          'read:vehicles', 'write:vehicles',
          'read:drivers', 'write:drivers',
          'read:passengers', 'write:passengers',
          'manage:users', 'read:audit',
          'export:data', 'read:history',
        ],
        operator: [
          'read:vehicles', 'write:vehicles',
          'read:drivers', 'write:drivers',
          'read:passengers', 'write:passengers',
          'export:data', 'read:history',
        ],
        viewer: [
          'read:vehicles', 'read:drivers',
          'read:passengers', 'read:history',
        ],
      }

      return (permMap[role] ?? []).includes(`${action}:${resource}`)
    },
    [user]
  )

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, hasPermission }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

