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

/**
 * Obtiene todos los vehículos de la flota navegando todas las páginas si total > 100.
 * Garantiza que el mapa y los KPIs representen el 100% de la flota sin duplicados.
 */
export async function getAllVehicles() {
  const firstPage = await getVehicles({
    page: 1,
    pageSize: 100,
  })

  const allItems = [...(firstPage.items || [])]
  const totalPages = firstPage.pages || 1

  if (totalPages > 1) {
    const pagePromises = []
    for (let p = 2; p <= totalPages; p++) {
      pagePromises.push(getVehicles({ page: p, pageSize: 100 }))
    }
    const remainingPages = await Promise.all(pagePromises)
    for (const res of remainingPages) {
      if (res?.items) {
        allItems.push(...res.items)
      }
    }
  }

  // Deduplicar por id para evitar duplicados en actualizaciones concurrentes
  const seen = new Set()
  const uniqueVehicles = []
  for (const vehicle of allItems) {
    if (vehicle && !seen.has(vehicle.id)) {
      seen.add(vehicle.id)
      uniqueVehicles.push(vehicle)
    }
  }

  return uniqueVehicles
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
