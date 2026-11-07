/**
 * auditService.js — Logs de auditoría del sistema.
 */

import { apiGet } from './apiClient'

/**
 * @param {{ page?: number, pageSize?: number, action?: string, resource?: string }} opts
 * @returns {Promise<{ items: Array, total: number, page: number, pages: number }>}
 */
export async function getAuditLogs({
  page = 1,
  pageSize = 20,
  action = '',
  resource = '',
} = {}) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  if (action) params.set('action', action)
  if (resource) params.set('resource', resource)
  return apiGet(`/audit?${params}`)
}
