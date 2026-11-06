/**
 * passengerService.js — CRUD de pasajeros + vinculación a unidades.
 */

import { apiGet, apiPost, apiPut, apiDelete, apiDownloadCsv } from './apiClient'

/**
 * @param {{ page?: number, pageSize?: number, search?: string }} opts
 */
export async function getPassengers({ page = 1, pageSize = 10, search = '' } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  if (search.trim()) params.set('search', search.trim())
  return apiGet(`/passengers?${params}`)
}

/**
 * @param {{ name: string, code?: string, custom_params?: Record<string,string> }} data
 */
export async function createPassenger(data) {
  return apiPost('/passengers', data)
}

/**
 * @param {string|number} id
 * @param {{ name?: string, code?: string, custom_params?: Record<string,string> }} data
 */
export async function updatePassenger(id, data) {
  return apiPut(`/passengers/${id}`, data)
}

/**
 * @param {string|number} id
 */
export async function deletePassenger(id) {
  return apiDelete(`/passengers/${id}`)
}

/**
 * @param {string|number} passengerId
 * @param {string|number} unitId
 */
export async function bindPassenger(passengerId, unitId) {
  return apiPost(`/passengers/${passengerId}/bind/${unitId}`, {})
}

/**
 * @param {string|number} passengerId
 * @param {string|number} unitId
 */
export async function unbindPassenger(passengerId, unitId) {
  return apiDelete(`/passengers/${passengerId}/bind/${unitId}`)
}

/**
 * Descarga el listado de pasajeros como CSV.
 */
export async function exportPassengersCsv() {
  return apiDownloadCsv('/export/passengers', 'pasajeros.csv')
}
