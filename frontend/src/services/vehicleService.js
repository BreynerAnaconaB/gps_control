/**
 * vehicleService.js — Consulta y gestión de vehículos y campos personalizados.
 */

import { apiGet, apiPatch, apiDelete } from './apiClient'

export async function getVehicles({
  page = 1,
  pageSize = 10,
  search = '',
  status = '',
} = {}) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })

  if (search.trim()) {
    params.set('search', search.trim())
  }

  if (status) {
    params.set('status', status)
  }

  return apiGet(`/vehicles?${params.toString()}`)
}

export async function getAllVehicles() {
  const data = await getVehicles({
    page: 1,
    pageSize: 100,
  })

  return data.items || []
}

export async function getVehicleDetail(vehicleId) {
  return apiGet(`/vehicles/${vehicleId}`)
}

/**
 * Crea o actualiza campos personalizados de un vehículo.
 * @param {number|string} vehicleId
 * @param {Array<{ field_id?: number, name: string, value: string }>} fields
 */
export async function updateVehicleCustomFields(vehicleId, fields) {
  return apiPatch(`/vehicles/${vehicleId}/custom-fields`, fields)
}

/**
 * Elimina un campo personalizado de un vehículo.
 * @param {number|string} vehicleId
 * @param {number} fieldId
 */
export async function deleteVehicleCustomField(vehicleId, fieldId) {
  return apiDelete(`/vehicles/${vehicleId}/custom-fields/${fieldId}`)
}
