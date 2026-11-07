import { useEffect, useRef, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import {
  Play,
  Pause,
  RotateCcw,
  Calendar,
  Truck,
  Gauge,
  Navigation,
  Activity,
  AlertCircle,
  Clock,
} from 'lucide-react'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/shared/PageHeader'
import ToastContainer from '../components/shared/Toast'
import { useToast } from '../components/shared/useToast'
import { getAllVehicles } from '../services/vehicleService'
import { getTripHistory } from '../services/historyService'
import './History.css'

// Iconos Leaflet personalizados
function createPinIcon(label, color) {
  return L.divIcon({
    className: 'custom-pin-marker',
    html: `<div class="pin-marker" style="background:${color}">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

function createPlaybackIcon() {
  return L.divIcon({
    className: 'playback-marker',
    html: `<div class="playback-dot">🚚</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

// Auto-ajuste de bounds cuando cambia el recorrido
function FitBounds({ points }) {
  const map = useMap()
  useEffect(() => {
    if (!points || points.length === 0) return
    const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude]))
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
    }
  }, [points, map])
  return null
}

export default function History() {
  const { toasts, push: toast, remove: removeToast } = useToast()

  const [vehicles, setVehicles] = useState([])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')

  // Fechas: por defecto el día de hoy
  const todayStr = new Date().toISOString().split('T')[0]
  const [fromDate, setFromDate] = useState(todayStr)
  const [toDate, setToDate] = useState(todayStr)

  const [historyData, setHistoryData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Playback
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    getAllVehicles()
      .then((data) => {
        setVehicles(data || [])
        if (data && data.length > 0) {
          setSelectedVehicleId(String(data[0].id))
        }
      })
      .catch(() => {})
  }, [])

  async function handleSearch(e) {
    if (e) e.preventDefault()
    if (!selectedVehicleId) {
      toast('warning', 'Selecciona un vehículo')
      return
    }

    if (fromDate > toDate) {
      toast('warning', 'La fecha inicial debe ser anterior o igual a la final')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setIsPlaying(false)
      setCurrentIndex(0)

      const result = await getTripHistory(selectedVehicleId, fromDate, toDate)
      setHistoryData(result)

      if (!result.points || result.points.length === 0) {
        toast('info', 'No se encontraron posiciones para este vehículo en ese rango.')
      } else {
        toast('success', `Cargados ${result.points.length} puntos de recorrido`)
      }
    } catch (err) {
      setError(err.message || 'Error al consultar historial')
      toast('error', err.message || 'Error al consultar historial')
    } finally {
      setLoading(false)
    }
  }

  // Loop de playback
  useEffect(() => {
    if (isPlaying && historyData?.points?.length > 0) {
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= historyData.points.length - 1) {
            setIsPlaying(false)
            return prev
          }
          return prev + 1
        })
      }, 150)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPlaying, historyData])

  function handlePlayPause() {
    if (!historyData?.points || historyData.points.length === 0) return
    if (currentIndex >= historyData.points.length - 1) {
      setCurrentIndex(0)
    }
    setIsPlaying((v) => !v)
  }

  function handleReset() {
    setIsPlaying(false)
    setCurrentIndex(0)
  }

  const points = historyData?.points || []
  const currentPoint = points[currentIndex] || null

  // Métricas calculadas
  const speeds = points.map((p) => p.speed || 0)
  const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0
  const avgSpeed =
    speeds.length > 0
      ? (speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1)
      : 0

  const polylineCoords = points.map((p) => [p.latitude, p.longitude])
  const startPoint = points[0] || null
  const endPoint = points[points.length - 1] || null

  const initialCenter = [4.711, -74.0721]

  return (
    <AppLayout
      title="Historial de Recorridos"
      breadcrumb="GPS Control / Historial"
      onRefresh={handleSearch}
      isRefreshing={loading}
    >
      <div className="history-container">
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        <PageHeader
          title="Reproducción de Rutas"
          subtitle="Consulta y reproducción de rutas históricas con telemetría Wialon"
        />
          {/* Barra de filtros superior */}
          <form className="history-filter-bar" onSubmit={handleSearch}>
            <div className="filter-group">
              <label htmlFor="select-vehicle">
                <Truck size={15} /> Vehículo
              </label>
              <select
                id="select-vehicle"
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}{v.plate && v.plate !== v.name ? ` (${v.plate})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="from-date">
                <Calendar size={15} /> Desde
              </label>
              <input
                id="from-date"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label htmlFor="to-date">
                <Calendar size={15} /> Hasta
              </label>
              <input
                id="to-date"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Consultando...' : 'Ver recorrido'}
            </button>
          </form>

          {error && (
            <div className="history-error-banner" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Grid de Mapa + Panel de Telemetría */}
          <div className="history-workspace">
            <div className="history-map-wrapper">
              <MapContainer
                center={initialCenter}
                zoom={12}
                scrollWheelZoom
                className="history-map"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {polylineCoords.length > 0 && (
                  <>
                    <Polyline
                      positions={polylineCoords}
                      pathOptions={{
                        color: '#eb162c',
                        weight: 4,
                        opacity: 0.85,
                      }}
                    />

                    {startPoint && (
                      <Marker
                        position={[startPoint.latitude, startPoint.longitude]}
                        icon={createPinIcon('A', '#1e8c93')}
                      >
                        <Popup>
                          <strong>Inicio de ruta</strong>
                          <br />
                          {startPoint.timestamp}
                        </Popup>
                      </Marker>
                    )}

                    {endPoint && (
                      <Marker
                        position={[endPoint.latitude, endPoint.longitude]}
                        icon={createPinIcon('B', '#eb162c')}
                      >
                        <Popup>
                          <strong>Fin de ruta</strong>
                          <br />
                          {endPoint.timestamp}
                        </Popup>
                      </Marker>
                    )}

                    {currentPoint && (
                      <Marker
                        position={[currentPoint.latitude, currentPoint.longitude]}
                        icon={createPlaybackIcon()}
                      >
                        <Popup>
                          <strong>Posición actual en reproducción</strong>
                          <br />
                          Velocidad: {currentPoint.speed} km/h
                          <br />
                          Rumbo: {currentPoint.heading}°
                          <br />
                          Fecha: {currentPoint.timestamp}
                        </Popup>
                      </Marker>
                    )}

                    <FitBounds points={points} />
                  </>
                )}
              </MapContainer>

              {/* Barra de controles de playback */}
              {points.length > 0 && (
                <div className="playback-controls">
                  <button
                    type="button"
                    className="playback-btn play"
                    onClick={handlePlayPause}
                    aria-label={isPlaying ? 'Pausar recorrido' : 'Reproducir recorrido'}
                  >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                    {isPlaying ? 'Pausa' : 'Play'}
                  </button>

                  <button
                    type="button"
                    className="playback-btn reset"
                    onClick={handleReset}
                    aria-label="Reiniciar reproducción"
                  >
                    <RotateCcw size={16} /> Reiniciar
                  </button>

                  <input
                    type="range"
                    min="0"
                    max={points.length - 1}
                    value={currentIndex}
                    onChange={(e) => {
                      setIsPlaying(false)
                      setCurrentIndex(Number(e.target.value))
                    }}
                    className="playback-slider"
                    aria-label="Progreso del recorrido"
                  />

                  <div className="playback-timer">
                    <Clock size={14} />
                    <span>
                      {currentIndex + 1} / {points.length}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Panel lateral con métricas de la ruta */}
            <aside className="history-telemetry-panel">
              <div className="telemetry-card">
                <h3>Resumen del Viaje</h3>
                <p style={{ color: '#6b6b6b', fontSize: '0.85rem' }}>
                  {historyData?.unit_name || 'Vehículo seleccionado'}
                </p>

                <div className="telemetry-kpis">
                  <div className="kpi-item">
                    <Navigation size={18} className="kpi-icon teal" />
                    <div>
                      <span>Distancia total</span>
                      <strong>{historyData?.distance_km?.toFixed(2) ?? '0.00'} km</strong>
                    </div>
                  </div>

                  <div className="kpi-item">
                    <Activity size={18} className="kpi-icon purple" />
                    <div>
                      <span>Total de puntos</span>
                      <strong>{historyData?.total_points ?? 0}</strong>
                    </div>
                  </div>

                  <div className="kpi-item">
                    <Gauge size={18} className="kpi-icon orange" />
                    <div>
                      <span>Velocidad máxima</span>
                      <strong>{maxSpeed} km/h</strong>
                    </div>
                  </div>

                  <div className="kpi-item">
                    <Gauge size={18} className="kpi-icon blue" />
                    <div>
                      <span>Velocidad promedio</span>
                      <strong>{avgSpeed} km/h</strong>
                    </div>
                  </div>
                </div>
              </div>

              {currentPoint && (
                <div className="telemetry-card live-point">
                  <h3>Punto actual</h3>
                  <div className="point-stats">
                    <div>
                      <span>Velocidad:</span>
                      <strong>{currentPoint.speed} km/h</strong>
                    </div>
                    <div>
                      <span>Rumbo:</span>
                      <strong>{currentPoint.heading}°</strong>
                    </div>
                    <div>
                      <span>Hora:</span>
                      <small>{currentPoint.timestamp}</small>
                    </div>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
    </AppLayout>
  )
}

