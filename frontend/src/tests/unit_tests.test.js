import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// ---------------------------------------------------------------------------
// 1. Telemetría y cálculo de estados de vehículo
// ---------------------------------------------------------------------------
function calculateVehicleStatus(lat, lon, speed, lastPositionDate) {
  if (lat == null || lon == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lon))) {
    return 'no_signal'
  }
  if (!lastPositionDate) return 'no_signal'

  const now = new Date()
  const ageMinutes = (now.getTime() - new Date(lastPositionDate).getTime()) / (1000 * 60)
  if (ageMinutes > 10) return 'no_signal'

  if (Number(speed) > 3.0) return 'moving'
  return 'stopped'
}

describe('Lógica de estado de vehículos', () => {
  test('Retorna no_signal cuando latitud o longitud son nulas', () => {
    assert.equal(calculateVehicleStatus(null, -74.0, 50, new Date()), 'no_signal')
    assert.equal(calculateVehicleStatus(4.6, null, 50, new Date()), 'no_signal')
  })

  test('Retorna no_signal cuando el último reporte tiene más de 10 minutos', () => {
    const oldDate = new Date(Date.now() - 15 * 60 * 1000)
    assert.equal(calculateVehicleStatus(4.6, -74.0, 20, oldDate), 'no_signal')
  })

  test('Retorna moving cuando la velocidad supera 3 km/h', () => {
    const freshDate = new Date()
    assert.equal(calculateVehicleStatus(4.6, -74.0, 45, freshDate), 'moving')
  })

  test('Retorna stopped cuando la velocidad es menor o igual a 3 km/h', () => {
    const freshDate = new Date()
    assert.equal(calculateVehicleStatus(4.6, -74.0, 0, freshDate), 'stopped')
    assert.equal(calculateVehicleStatus(4.6, -74.0, 2.5, freshDate), 'stopped')
  })
})

// ---------------------------------------------------------------------------
// 2. Control de Acceso basado en Roles (RBAC Frontend Hints)
// ---------------------------------------------------------------------------
const PERMISSION_MAP = {
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

function hasPermission(role, action, resource) {
  if (!role) return false
  const list = PERMISSION_MAP[role.toLowerCase()] || []
  return list.includes(`${action}:${resource}`)
}

describe('Lógica de permisos RBAC en cliente', () => {
  test('Viewer solo puede leer y no escribir', () => {
    assert.equal(hasPermission('viewer', 'read', 'vehicles'), true)
    assert.equal(hasPermission('viewer', 'write', 'vehicles'), false)
    assert.equal(hasPermission('viewer', 'manage', 'users'), false)
    assert.equal(hasPermission('viewer', 'read', 'audit'), false)
  })

  test('Operator puede operar flota pero no administrar usuarios ni auditoría', () => {
    assert.equal(hasPermission('operator', 'write', 'vehicles'), true)
    assert.equal(hasPermission('operator', 'write', 'drivers'), true)
    assert.equal(hasPermission('operator', 'export', 'data'), true)
    assert.equal(hasPermission('operator', 'manage', 'users'), false)
    assert.equal(hasPermission('operator', 'read', 'audit'), false)
  })

  test('Admin tiene acceso completo al sistema', () => {
    assert.equal(hasPermission('admin', 'manage', 'users'), true)
    assert.equal(hasPermission('admin', 'read', 'audit'), true)
    assert.equal(hasPermission('admin', 'write', 'vehicles'), true)
  })
})

// ---------------------------------------------------------------------------
// 3. Deduplicación de vehículos al paginar
// ---------------------------------------------------------------------------
describe('Deduplicación de lista de vehículos', () => {
  test('Elimina duplicados concurrentes preservando orden', () => {
    const rawList = [
      { id: 101, name: 'Camión 1' },
      { id: 102, name: 'Camión 2' },
      { id: 101, name: 'Camión 1 Duplicado' },
      { id: 103, name: 'Camión 3' },
    ]
    const seen = new Set()
    const deduplicated = []
    for (const item of rawList) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        deduplicated.push(item)
      }
    }
    assert.equal(deduplicated.length, 3)
    assert.deepEqual(deduplicated.map(v => v.id), [101, 102, 103])
  })
})

