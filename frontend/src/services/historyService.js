/**
 * historyService.js — Historial de recorridos por vehículo.
 */

import { apiGet } from './apiClient'

/**
 * Obtiene los puntos GPS históricos de un vehículo en un rango de fechas.
 * @param {string|number} vehicleId
 * @param {string} fromDate — YYYY-MM-DD
 * @param {string} toDate   — YYYY-MM-DD
 * @returns {Promise<Array<{ lat: number, lng: number, speed: number, timestamp: string }>>}
 */
export async function getTripHistory(vehicleId, fromDate, toDate) {
  const fromIso = fromDate && !fromDate.includes('T') ? `${fromDate}T00:00:00` : fromDate
  const toIso = toDate && !toDate.includes('T') ? `${toDate}T23:59:59` : toDate
  const params = new URLSearchParams({ from: fromIso, to: toIso })
  return apiGet(`/vehicles/${vehicleId}/history?${params}`)
}
