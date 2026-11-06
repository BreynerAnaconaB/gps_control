/**
 * driverService.js — CRUD de conductores + vinculación a unidades.
 */

import { apiGet, apiPost, apiPut, apiDelete, apiDownloadCsv } from './apiClient'

/**
 * @param {{ page?: number, pageSize?: number, search?: string }} opts
 */
export async function getDrivers({ page = 1, pageSize = 10, search = '' } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  if (search.trim()) params.set('search', search.trim())
  return apiGet(`/drivers?${params}`)
}

/**
 * @param {{ name: string, code?: string, phone?: string }} data
 */
export async function createDriver(data) {
  return apiPost('/drivers', data)
}

/**
 * @param {string|number} id
 * @param {{ name?: string, code?: string, phone?: string }} data
 */
export async function updateDriver(id, data) {
  return apiPut(`/drivers/${id}`, data)
}

/**
 * @param {string|number} id
 */
export async function deleteDriver(id) {
  return apiDelete(`/drivers/${id}`)
}

/**
 * Vincula un conductor a una unidad GPS.
 * @param {string|number} driverId
 * @param {string|number} unitId
 */
export async function bindDriver(driverId, unitId) {
  return apiPost(`/drivers/${driverId}/bind/${unitId}`, {})
}

/**
 * Desvincula un conductor de una unidad.
 * @param {string|number} driverId
 * @param {string|number} unitId
 */
export async function unbindDriver(driverId, unitId) {
  return apiDelete(`/drivers/${driverId}/bind/${unitId}`)
}

/**
 * Descarga el listado de conductores como CSV.
 */
export async function exportDriversCsv() {
  return apiDownloadCsv('/export/drivers', 'conductores.csv')
}
