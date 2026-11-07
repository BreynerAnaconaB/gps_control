import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { Clock3, Download, ServerCrash } from 'lucide-react'

import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import RoleGuard from './components/RoleGuard'
import AppLayout from './components/AppLayout'

import Landing from './pages/Landing'
import Login from './pages/Login'
import Drivers from './pages/Drivers'
import Passengers from './pages/Passengers'
import History from './pages/History'
import Users from './pages/Users'
import Audit from './pages/Audit'
import ChangePassword from './pages/ChangePassword'

import StatsCards from './components/StatsCards'
import StatusChart from './components/StatusChart'
import ActivityChart from './components/ActivityChart'
import VehicleList from './components/VehicleList'
import FleetMap from './components/FleetMap'
import VehicleDetail from './components/VehicleDetail'
import Modal from './components/shared/Modal'
import StatusBadge from './components/shared/StatusBadge'

import { getVehicles, getAllVehicles } from './services/vehicleService'
import { getDrivers } from './services/driverService'
import { getPassengers } from './services/passengerService'
import { apiDownloadCsv } from './services/apiClient'

import './App.css'

// ---------------------------------------------------------------------------
// Cold Start Banner (DEP-04)
// ---------------------------------------------------------------------------

function ColdStartBanner() {
  const [coldStart, setColdStart] = useState({ isColdStarting: false })

  useEffect(() => {
    function handleColdStart(event) {
      if (event?.detail) {
        setColdStart(event.detail)
      }
    }

    window.addEventListener('cold-start-status', handleColdStart)
    return () => window.removeEventListener('cold-start-status', handleColdStart)
  }, [])

  if (!coldStart.isColdStarting) return null

  return (
    <div className="cold-start-banner" role="status" aria-live="polite">
      <ServerCrash size={18} className="animate-spin" />
      <span>
        El servidor backend se está iniciando (arranque en frío de plan gratuito).
        Reintentando en {coldStart.waitSeconds}s (intento {coldStart.attempt}/
        {coldStart.maxAttempts}). Por favor espera unos momentos...
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard (protected)
// ---------------------------------------------------------------------------

function Dashboard() {
  const navigate = useNavigate()
  const [vehicles, setVehicles] = useState([])
  const [vehiclePage, setVehiclePage] = useState({
    items: [],
    total: 0,
    page: 1,
    page_size: 10,
    pages: 0,
  })
  const [counts, setCounts] = useState({ drivers: null, passengers: null })
  const [driversList, setDriversList] = useState([])
  const [passengersList, setPassengersList] = useState([])
  const [activeStatModal, setActiveStatModal] = useState(null)
  const [statSearch, setStatSearch] = useState('')

  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  const loadVehicles = useCallback(
    async (isInitial = false) => {
      try {
        setError(null)
        if (isInitial) {
          setLoading(true)
        } else {
          setIsRefreshing(true)
        }

        const [allVehicles, paginatedData, driversRes, passengersRes] = await Promise.all([
          getAllVehicles(),
          getVehicles({ page, pageSize: 10, search, status }),
          getDrivers({ page: 1, pageSize: 100 }).catch(() => ({ items: [], total: 0 })),
          getPassengers({ page: 1, pageSize: 100 }).catch(() => ({ items: [], total: 0 })),
        ])

        const drivers = driversRes.items || []
        const passengers = passengersRes.items || []
        setDriversList(drivers)
        setPassengersList(passengers)
        setCounts({
          drivers: driversRes.total ?? drivers.length,
          passengers: passengersRes.total ?? passengers.length,
        })

        // Correlacionar conductores asignados con vehículos en tiempo real
        const driverByUnitId = new Map(
          drivers
            .filter((d) => Boolean(d.assigned_unit_id))
            .map((d) => [Number(d.assigned_unit_id), d])
        )

        const enrich = (vList) =>
          vList.map((v) => {
            const driver = driverByUnitId.get(Number(v.id))
            if (driver) {
              return {
                ...v,
                assigned_driver_name: driver.name,
                assigned_driver_id: driver.id,
              }
            }
            return v
          })

        const enrichedAll = enrich(allVehicles)
        setVehicles(enrichedAll)
        setVehiclePage({
          ...paginatedData,
          items: enrich(paginatedData.items || []),
        })

        setSelectedVehicle((current) => {
          if (!current) return null
          return enrichedAll.find((v) => v.id === current.id) ?? null
        })
        setLastUpdate(new Date())
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
        setIsRefreshing(false)
      }
    },
    [page, search, status]
  )

  // Initial load and on filter/page change
  useEffect(() => {
    loadVehicles(vehicles.length === 0)
  }, [loadVehicles])

  // Polling every 30 s — pause when tab is hidden (RF-14), immediate refresh on tab reactivation
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) {
        loadVehicles(false)
      }
    }, 30000)

    function handleVisibility() {
      if (!document.hidden) {
        loadVehicles(false)
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [loadVehicles])

  const handleSearch = (value) => {
    setSearch(value)
    setPage(1)
  }

  const handleStatusChange = (value) => {
    setStatus(value)
    setPage(1)
  }

  const handleExportVehicles = () => {
    apiDownloadCsv('/export/vehicles', 'vehiculos.csv').catch((err) =>
      alert(err.message || 'Error al exportar')
    )
  }

  const handleCardClick = (stat) => {
    setStatSearch('')
    setActiveStatModal(stat)
  }

  const handleSelectVehicleFromModal = (vehicle) => {
    setSelectedVehicle(vehicle)
    setActiveStatModal(null)
  }

  // Filtrado de elementos para el popup interactivo de KPIs
  const getModalFilteredItems = () => {
    if (!activeStatModal) return []
    const q = statSearch.trim().toLowerCase()

    if (activeStatModal.id === 'total_drivers') {
      return driversList.filter(
        (d) =>
          !q ||
          d.name?.toLowerCase().includes(q) ||
          d.code?.toLowerCase().includes(q) ||
          d.phone?.toLowerCase().includes(q)
      )
    }

    if (activeStatModal.id === 'total_passengers') {
      return passengersList.filter(
        (p) => !q || p.name?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q)
      )
    }

    // Filtrar flota de vehículos según la tarjeta clicada
    let filtered = vehicles
    if (activeStatModal.id === 'moving') {
      filtered = vehicles.filter((v) => v.status === 'moving')
    } else if (activeStatModal.id === 'stopped') {
      filtered = vehicles.filter((v) => v.status === 'stopped')
    } else if (activeStatModal.id === 'no_signal') {
      filtered = vehicles.filter((v) => v.status === 'no_signal')
    } else if (activeStatModal.id === 'with_driver') {
      const assignedIds = new Set(
        driversList.filter((d) => d.assigned_unit_id).map((d) => Number(d.assigned_unit_id))
      )
      filtered = vehicles.filter((v) => Boolean(v.assigned_driver_name) || assignedIds.has(Number(v.id)))
    } else if (activeStatModal.id === 'without_driver') {
      const assignedIds = new Set(
        driversList.filter((d) => d.assigned_unit_id).map((d) => Number(d.assigned_unit_id))
      )
      filtered = vehicles.filter((v) => !v.assigned_driver_name && !assignedIds.has(Number(v.id)))
    }

    if (q) {
      filtered = filtered.filter(
        (v) =>
          v.name?.toLowerCase().includes(q) ||
          v.plate?.toLowerCase().includes(q) ||
          v.assigned_driver_name?.toLowerCase().includes(q)
      )
    }

    return filtered
  }

  const modalItems = getModalFilteredItems()

  const exportAction = (
    <RoleGuard action="export" resource="data">
      <button
        className="topbar-icon-btn"
        type="button"
        onClick={handleExportVehicles}
        title="Exportar flota a CSV"
        aria-label="Exportar flota a CSV"
      >
        <Download size={17} />
      </button>
    </RoleGuard>
  )

  return (
    <AppLayout
      title="Panel de control"
      breadcrumb="GPS Control / Monitoreo"
      actions={exportAction}
      onRefresh={() => loadVehicles(false)}
      isRefreshing={isRefreshing}
    >
      <div className="welcome-row">
        <div>
          <h2>Resumen de flota</h2>
          <p>Consulta y monitorea tus vehículos en tiempo real con Wialon.</p>
        </div>

        <div className="last-update">
          <Clock3 size={15} />
          {lastUpdate
            ? `Actualizado ${lastUpdate.toLocaleTimeString('es-CO')}`
            : 'Esperando datos...'}
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button type="button" onClick={() => loadVehicles(false)}>
            Reintentar
          </button>
        </div>
      )}

      {/* KPIs de la Flota (RF-23: con/sin conductor, conductores, pasajeros) */}
      <StatsCards
        vehicles={vehicles}
        driversCount={counts.drivers}
        passengersCount={counts.passengers}
        driversWithUnitCount={driversList.filter((d) => Boolean(d.assigned_unit_id)).length}
        onCardClick={handleCardClick}
      />

      {/* Gráficas Visuales de Estado y Velocidad (RF-23) */}
      <div className="charts-row">
        <div className="chart-card">
          <h3>Distribución por Estado</h3>
          <StatusChart vehicles={vehicles} />
        </div>

        <div className="chart-card">
          <h3>Top Velocidad en Vivo</h3>
          <ActivityChart vehicles={vehicles} />
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          Cargando información de la flota...
        </div>
      ) : (
        <section className="monitoring-layout">
          <div className="map-section">
            <div className="section-heading">
              <div>
                <h3>Ubicación de vehículos</h3>
                <p>Posiciones recibidas desde Wialon en tiempo real</p>
              </div>
              <span className="live-badge">EN VIVO</span>
            </div>

            <FleetMap
              vehicles={vehicles}
              selectedVehicle={selectedVehicle}
              onSelect={setSelectedVehicle}
            />
          </div>

          <VehicleList
            vehicles={vehiclePage.items}
            total={vehiclePage.total}
            page={vehiclePage.page}
            pages={vehiclePage.pages}
            search={search}
            status={status}
            onSearch={handleSearch}
            onStatusChange={handleStatusChange}
            onPageChange={setPage}
            selectedVehicle={selectedVehicle}
            onSelect={setSelectedVehicle}
          />

          {selectedVehicle && (
            <VehicleDetail
              vehicle={selectedVehicle}
              onClose={() => setSelectedVehicle(null)}
            />
          )}
        </section>
      )}

      {/* Modal Popup de Detalle de Métrica Clicada */}
      <Modal
        open={Boolean(activeStatModal)}
        title={activeStatModal?.label || 'Detalle de Métrica'}
        onClose={() => setActiveStatModal(null)}
        size="lg"
      >
        <div>
          <p className="stat-popup-header-desc">
            {activeStatModal?.id === 'total_drivers'
              ? 'Listado de conductores registrados en la plataforma y sus asignaciones actuales.'
              : activeStatModal?.id === 'total_passengers'
              ? 'Listado de pasajeros registrados y vehículos asociados.'
              : `Mostrando vehículos correspondientes al filtro "${activeStatModal?.label}" (${modalItems.length} unidades).`}
          </p>

          <input
            type="search"
            className="stat-popup-search-input"
            placeholder={
              activeStatModal?.id === 'total_drivers'
                ? 'Buscar por nombre, código o teléfono...'
                : activeStatModal?.id === 'total_passengers'
                ? 'Buscar por nombre o código...'
                : 'Buscar vehículo por nombre, placa o conductor...'
            }
            value={statSearch}
            onChange={(e) => setStatSearch(e.target.value)}
            autoFocus
          />

          <div className="stat-popup-table-wrap">
            {activeStatModal?.id === 'total_drivers' ? (
              <table className="stat-popup-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Código / Cédula</th>
                    <th>Teléfono</th>
                    <th>Vehículo Asignado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {modalItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                        No se encontraron conductores.
                      </td>
                    </tr>
                  ) : (
                    modalItems.map((driver) => {
                      const assignedVehicle = vehicles.find(
                        (v) => Number(v.id) === Number(driver.assigned_unit_id)
                      )
                      return (
                        <tr key={driver.id}>
                          <td>
                            <strong>{driver.name}</strong>
                          </td>
                          <td>{driver.code || '—'}</td>
                          <td>{driver.phone || '—'}</td>
                          <td>
                            {driver.assigned_unit_id ? (
                              <span style={{ color: 'var(--brand-teal)', fontWeight: 600 }}>
                                🚚 {assignedVehicle?.name || `Unidad #${driver.assigned_unit_id}`}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>Sin asignar</span>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="stat-popup-action-btn"
                              onClick={() => {
                                setActiveStatModal(null)
                                navigate('/app/drivers')
                              }}
                            >
                              Gestionar ↗
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            ) : activeStatModal?.id === 'total_passengers' ? (
              <table className="stat-popup-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Código</th>
                    <th>Vehículo Asignado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {modalItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>
                        No se encontraron pasajeros.
                      </td>
                    </tr>
                  ) : (
                    modalItems.map((p) => {
                      const assignedVehicle = vehicles.find(
                        (v) => Number(v.id) === Number(p.assigned_unit_id)
                      )
                      return (
                        <tr key={p.id}>
                          <td>
                            <strong>{p.name}</strong>
                          </td>
                          <td>{p.code || '—'}</td>
                          <td>
                            {p.assigned_unit_id ? (
                              <span style={{ color: 'var(--brand-teal)', fontWeight: 600 }}>
                                🚚 {assignedVehicle?.name || `Unidad #${p.assigned_unit_id}`}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>Sin asignar</span>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="stat-popup-action-btn"
                              onClick={() => {
                                setActiveStatModal(null)
                                navigate('/app/passengers')
                              }}
                            >
                              Gestionar ↗
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            ) : (
              <table className="stat-popup-table">
                <thead>
                  <tr>
                    <th>Vehículo</th>
                    <th>Estado</th>
                    <th>Velocidad</th>
                    <th>Conductor</th>
                    <th>Último Reporte</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {modalItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                        No hay vehículos que coincidan con el filtro.
                      </td>
                    </tr>
                  ) : (
                    modalItems.map((vehicle) => (
                      <tr
                        key={vehicle.id}
                        className="stat-popup-row"
                        onClick={() => handleSelectVehicleFromModal(vehicle)}
                      >
                        <td>
                          <strong>{vehicle.name}</strong>
                          {vehicle.plate && vehicle.plate !== vehicle.name && (
                            <small style={{ display: 'block', color: 'var(--text-secondary)' }}>
                              Placa: {vehicle.plate}
                            </small>
                          )}
                        </td>
                        <td>
                          <StatusBadge status={vehicle.status} />
                        </td>
                        <td>
                          {vehicle.speed != null ? `${Math.round(vehicle.speed)} km/h` : '0 km/h'}
                        </td>
                        <td>
                          {vehicle.assigned_driver_name ? (
                            <span style={{ color: 'var(--brand-teal)', fontWeight: 600 }}>
                              👤 {vehicle.assigned_driver_name}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Sin conductor</span>
                          )}
                        </td>
                        <td>
                          <small>
                            {vehicle.last_position
                              ? new Date(vehicle.last_position).toLocaleTimeString('es-CO', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Sin señal'}
                          </small>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="stat-popup-action-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSelectVehicleFromModal(vehicle)
                            }}
                          >
                            Ver en mapa 📍
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </Modal>
    </AppLayout>
  )
}

// ---------------------------------------------------------------------------
// App — routing root
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ColdStartBanner />
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />

            {/* Protected routes */}
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/app/drivers"
              element={
                <ProtectedRoute>
                  <Drivers />
                </ProtectedRoute>
              }
            />

            <Route
              path="/app/passengers"
              element={
                <ProtectedRoute>
                  <Passengers />
                </ProtectedRoute>
              }
            />

            <Route
              path="/app/history"
              element={
                <ProtectedRoute>
                  <History />
                </ProtectedRoute>
              }
            />

            <Route
              path="/app/users"
              element={
                <ProtectedRoute>
                  <Users />
                </ProtectedRoute>
              }
            />

            <Route
              path="/app/audit"
              element={
                <ProtectedRoute>
                  <Audit />
                </ProtectedRoute>
              }
            />

            <Route
              path="/app/change-password"
              element={
                <ProtectedRoute>
                  <ChangePassword />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
