
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'

// ---------------------------------------------------------------------------
// Token storage — access token only in memory (not localStorage: SEG-02)
// Refresh token lives in an HttpOnly cookie managed by the browser.
// ---------------------------------------------------------------------------

let _accessToken = null

export function setAccessToken(token) {
  _accessToken = token
  if (token) {
    try {
      sessionStorage.setItem('access_token', token)
    } catch {}
  }
}

export function getAccessToken() {
  if (_accessToken) return _accessToken
  try {
    return sessionStorage.getItem('access_token')
  } catch {
    return null
  }
}

export function clearAccessToken() {
  _accessToken = null
  try {
    sessionStorage.removeItem('access_token')
    sessionStorage.removeItem('auth_user')
  } catch {}
}

// ---------------------------------------------------------------------------
// Base fetch with auto-refresh and deduplicated refresh promise
// ---------------------------------------------------------------------------

let _refreshPromise = null

export async function refreshSession() {
  if (_refreshPromise) {
    return _refreshPromise
  }

  _refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        clearAccessToken()
        return null
      }
      const data = await res.json()
      if (data?.access_token) {
        setAccessToken(data.access_token)
      }
      if (data?.user) {
        try {
          sessionStorage.setItem('auth_user', JSON.stringify(data.user))
        } catch {}
      }
      return data
    } catch {
      return null
    } finally {
      _refreshPromise = null
    }
  })()

  return _refreshPromise
}

async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  }

  const token = getAccessToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  // Auto-refresh on 401 (evita bucles en login y refresh)
  if (response.status === 401 && path !== '/auth/refresh' && path !== '/auth/login' && !options._isRetry) {
    const refreshed = await refreshSession()
    if (refreshed?.access_token) {
      headers['Authorization'] = `Bearer ${refreshed.access_token}`
      return fetch(`${API_URL}${path}`, {
        ...options,
        headers,
        credentials: 'include',
      })
    }
  }

  return response
}

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------

export async function login(email, password) {
  const response = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Error al iniciar sesión')
  }

  const data = await response.json()
  setAccessToken(data.access_token)
  try {
    sessionStorage.setItem('auth_user', JSON.stringify(data.user))
  } catch {}
  return data
}

export async function logout() {
  await apiFetch('/auth/logout', { method: 'POST' })
  clearAccessToken()
}


export async function getMe() {
  const res = await apiFetch('/auth/me')
  if (!res.ok) return null
  return res.json()
}

export async function changePassword(currentPassword, newPassword) {
  const res = await apiFetch('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Error al cambiar la contraseña')
  }
}

// ---------------------------------------------------------------------------
// User management (Admin only)
// ---------------------------------------------------------------------------

export async function getUsers() {
  const res = await apiFetch('/auth/users')
  if (!res.ok) throw new Error('Error al obtener usuarios')
  return res.json()
}

export async function createUser(email, password, role) {
  const res = await apiFetch('/auth/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, role }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Error al crear usuario')
  }
  return res.json()
}

export async function updateUser(userId, payload) {
  const res = await apiFetch(`/auth/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Error al actualizar usuario')
  }
  return res.json()
}

