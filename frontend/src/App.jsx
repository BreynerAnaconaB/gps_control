import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Bell, Clock3 } from 'lucide-react'

import Sidebar from './components/Sidebar'
import StatsCards from './components/StatsCards'
import VehicleList from './components/VehicleList'
import FleetMap from './components/FleetMap'
import { getVehicles } from './services/vehicleService'

import './App.css'

function App() {
  const [vehicles, setVehicles] = useState([])
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  const loadVehicles = useCallback(async () => {
    try {
      setError(null)
      const data = await getVehicles()

      setVehicles(data)

      setSelectedVehicle((current) => {
        if (!current) return null
        return data.find((vehicle) => vehicle.id === current.id) ?? null
      })

      setLastUpdate(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadVehicles()

    const interval = setInterval(loadVehicles, 30000)

    return () => clearInterval(interval)
  }, [loadVehicles])

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="breadcrumb">GPS Control / Monitoreo</span>
            <h1>Panel de control</h1>
          </div>

          <div className="topbar-actions">
            <div className="connection-status">
              <span className="status-dot moving" />
              Sistema de monitoreo
            </div>

            <button
              className="icon-button"
              type="button"
              onClick={loadVehicles}
              title="Actualizar vehículos"
            >
              <RefreshCw size={19} />
            </button>

            <button className="icon-button" type="button" title="Notificaciones">
              <Bell size={19} />
            </button>
          </div>
        </header>

        <section className="dashboard-body">
          <div className="welcome-row">
            <div>
              <h2>Resumen de flota</h2>
              <p>Consulta y monitorea tus vehículos en tiempo real.</p>
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
              <button type="button" onClick={loadVehicles}>
                Reintentar
              </button>
            </div>
          )}

          <StatsCards vehicles={vehicles} />

          {loading ? (
            <div className="loading-state">Cargando información de la flota...</div>
          ) : (
            <section className="monitoring-layout">
              <div className="map-section">
                <div className="section-heading">
                  <div>
                    <h3>Ubicación de vehículos</h3>
                    <p>Posiciones recibidas desde Wialon</p>
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
                vehicles={vehicles}
                selectedVehicle={selectedVehicle}
                onSelect={setSelectedVehicle}
              />
            </section>
          )}
        </section>
      </main>
    </div>
  )
}

export default App