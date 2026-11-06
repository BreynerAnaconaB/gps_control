/**
 * apiClient.js — Wrapper de fetch con Authorization header automático,
 * renovación de token y manejo de arranque en frío (DEP-04) con backoff exponencial.
 */

import { getAccessToken } from './authService'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'

const MAX_COLD_START_RETRIES = 4
const RETRY_DELAYS = [3000, 5000, 8000, 12000] // ms

function notifyColdStart(status) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cold-start-status', { detail: status }))
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractErrorMessage(err, defaultMsg) {
  if (!err) return defaultMsg
  if (typeof err.detail === 'string') return err.detail
  if (Array.isArray(err.detail) && err.detail.length > 0) {
    const first = err.detail[0]
    const field = first.loc ? first.loc[first.loc.length - 1] : ''
    const msg = first.msg || 'Dato inválido'
    if (msg.includes('valid email')) return 'El correo electrónico no tiene un formato válido'
    if (field === 'email') return 'Ingresa un correo electrónico válido'
    if (field === 'password') return 'La contraseña debe tener al menos 8 caracteres'
    return `${field ? field + ': ' : ''}${msg}`
  }
  return err.message || defaultMsg
}

async function parseJsonResponse(res) {
  if (res.status === 204) return null
  const text = await res.text()
  if (!text || !text.trim()) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function baseFetch(path, options = {}) {
  const token = getAccessToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let attempt = 0

  while (attempt <= MAX_COLD_START_RETRIES) {
    try {
      const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
        credentials: 'include',
      })

      // Status 502, 503, 504 are typical symptoms of a waking container (DEP-04)
      if ([502, 503, 504].includes(res.status) && attempt < MAX_COLD_START_RETRIES) {
        const delay = RETRY_DELAYS[attempt] || 5000
        notifyColdStart({
          isColdStarting: true,
          attempt: attempt + 1,
          maxAttempts: MAX_COLD_START_RETRIES,
          waitSeconds: Math.round(delay / 1000),
          status: res.status,
        })
        attempt++
        await sleep(delay)
        continue
      }

      // If successful or client error, notify cold start resolved
      notifyColdStart({ isColdStarting: false })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        let err = {}
        try {
          err = JSON.parse(text)
        } catch {
          err = { detail: text }
        }
        throw new Error(extractErrorMessage(err, `Error ${res.status}: ${res.statusText}`))
      }

      return res
    } catch (networkError) {
      const isNetworkError =
        networkError.name === 'TypeError' ||
        networkError.message.includes('Failed to fetch') ||
        networkError.message.includes('NetworkError')

      if (isNetworkError && attempt < MAX_COLD_START_RETRIES) {
        const delay = RETRY_DELAYS[attempt] || 5000
        notifyColdStart({
          isColdStarting: true,
          attempt: attempt + 1,
          maxAttempts: MAX_COLD_START_RETRIES,
          waitSeconds: Math.round(delay / 1000),
          status: 'connecting',
        })
        attempt++
        await sleep(delay)
        continue
      }

      notifyColdStart({ isColdStarting: false })
      throw networkError
    }
  }
}

export async function apiGet(path) {
  const res = await baseFetch(path)
  return parseJsonResponse(res)
}

export async function apiPost(path, body) {
  const res = await baseFetch(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return parseJsonResponse(res)
}

export async function apiPut(path, body) {
  const res = await baseFetch(path, {
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return parseJsonResponse(res)
}

export async function apiPatch(path, body) {
  const res = await baseFetch(path, {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return parseJsonResponse(res)
}

export async function apiDelete(path) {
  await baseFetch(path, { method: 'DELETE' })
}

/**
 * Descarga un CSV desde `path` y lo guarda con el nombre `filename`.
 */
export async function apiDownloadCsv(path, filename) {
  const token = getAccessToken()
  const headers = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_URL}${path}`, {
    headers,
    credentials: 'include',
  })

  if (!res.ok) {
    throw new Error(`Error al descargar CSV: ${res.status}`)
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
