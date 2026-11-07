
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'

// ---------------------------------------------------------------------------
// Token storage — access token only in memory (not localStorage: SEG-02)
// Refresh token lives in an HttpOnly cookie managed by the browser.
// ---------------------------------------------------------------------------

let _accessToken = null

export function setAccessToken(token) {
  _accessToken = token
}

export function getAccessToken() {
  return _accessToken
}

export function clearAccessToken() {
  _accessToken = null
}

// ---------------------------------------------------------------------------
// Base fetch with auto-refresh
// ---------------------------------------------------------------------------

async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  }

  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  // Auto-refresh on 401
  if (response.status === 401 && path !== '/auth/refresh' && path !== '/auth/login') {
    const refreshed = await tryRefresh()
    if (refreshed) {
      headers['Authorization'] = `Bearer ${_accessToken}`
      return fetch(`${API_URL}${path}`, {
        ...options,
        headers,
        credentials: 'include',
      })
    }
  }

  return response
}

async function tryRefresh() {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) return false
    const data = await res.json()
    setAccessToken(data.access_token)
    return true
  } catch {
    return false
  }
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
  return data
}

export async function logout() {
  await apiFetch('/auth/logout', { method: 'POST' })
  clearAccessToken()
}

export async function refreshSession() {
  const res = await apiFetch('/auth/refresh', { method: 'POST' })
  if (!res.ok) return null
  const data = await res.json()
  setAccessToken(data.access_token)
  return data
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

