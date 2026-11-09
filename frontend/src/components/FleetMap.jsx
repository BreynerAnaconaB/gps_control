
import { useEffect, useRef, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
} from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import { getGeofences } from '../services/vehicleService'
import 'leaflet/dist/leaflet.css'

function createVehicleIcon(status) {
  const validStatuses = ['moving', 'stopped', 'no_signal']
  const safeStatus = validStatuses.includes(status)
    ? status
    : 'no_signal'

  return L.divIcon({
    className: 'vehicle-marker',
    html: `<div class="marker-inner ${safeStatus}">🚚</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  })
}

function MapFocus({ vehicle }) {
  const map = useMap()

  useEffect(() => {
    if (
      vehicle?.latitude != null &&
      vehicle?.longitude != null
    ) {
      map.flyTo(
        [vehicle.latitude, vehicle.longitude],
        16,
        { duration: 1 }
      )
    }
  }, [vehicle, map])

  return null
}

function FitAllVehicles({ vehicles }) {
  const map = useMap()
  const hasFitted = useRef(false)

  useEffect(() => {
    if (hasFitted.current || vehicles.length === 0) return

    const bounds = L.latLngBounds(
      vehicles.map((vehicle) => [
        vehicle.latitude,
        vehicle.longitude,
      ])
    )

    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 13,
      })

      hasFitted.current = true
    }
  }, [vehicles, map])

  return null
}

const statusLabels = {
  moving: 'En movimiento',
  stopped: 'Detenido',
  no_signal: 'Sin señal',
}

export default function FleetMap({
  vehicles,
  selectedVehicle,
  onSelect,
}) {
  const [geofences, setGeofences] = useState([])
  const [showGeofences, setShowGeofences] = useState(true)

  useEffect(() => {
    getGeofences()
      .then((data) => {
        if (Array.isArray(data)) setGeofences(data)
      })
      .catch(() => {})
  }, [])

  const validVehicles = vehicles.filter(
    (vehicle) =>
      Number.isFinite(vehicle.latitude) &&
      Number.isFinite(vehicle.longitude) &&
      vehicle.latitude >= -90 &&
      vehicle.latitude <= 90 &&
      vehicle.longitude >= -180 &&
      vehicle.longitude <= 180
  )

  const initialPosition = validVehicles.length
    ? [validVehicles[0].latitude, validVehicles[0].longitude]
    : [4.711, -74.0721]

  return (
    <div className="map-wrapper">
      <MapContainer
        center={initialPosition}
        zoom={12}
        scrollWheelZoom
        className="fleet-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MarkerClusterGroup
          chunkedLoading
          showCoverageOnHover={false}
          spiderfyOnMaxZoom
          maxClusterRadius={50}
        >
          {validVehicles.map((vehicle) => (
            <Marker
              key={vehicle.id}
              position={[vehicle.latitude, vehicle.longitude]}
              icon={createVehicleIcon(vehicle.status)}
              eventHandlers={{
                click: () => onSelect(vehicle),
              }}
            >
              <Popup>
                <strong>{vehicle.name}</strong>
                <br />
                <strong>Conductor:</strong>{' '}
                {vehicle.assigned_driver_name
                  ? `👤 ${vehicle.assigned_driver_name}`
                  : '❌ Sin conductor vinculado'}
                <br />
                Estado: {statusLabels[vehicle.status] || 'Desconocido'}
                <br />
                Velocidad: {vehicle.speed ?? 0} km/h
                <br />
                Dirección: {vehicle.direction ?? 'N/D'}
                <br />
                Altitud: {vehicle.altitude ?? 'N/D'} m
                <br />
                Último reporte:{' '}
                {vehicle.last_position
                  ? new Date(vehicle.last_position).toLocaleString('es-CO')
                  : 'Sin información'}
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>

        <FitAllVehicles vehicles={validVehicles} />
        <MapFocus vehicle={selectedVehicle} />

        {/* Visualización de Geocercas de Wialon (Bonus 12) */}
        {showGeofences &&
          geofences.map((gf) => (
            <Circle
              key={`gf-${gf.id}`}
              center={[gf.latitude, gf.longitude]}
              radius={gf.radius || 100}
              pathOptions={{
                color: '#1E8C93',
                fillColor: '#1E8C93',
                fillOpacity: 0.18,
                weight: 2,
                dashArray: '4, 4',
              }}
            >
              <Popup>
                <strong>Geocerca Wialon:</strong> {gf.name}
                <br />
                {gf.description && <small>{gf.description}<br /></small>}
                Radio: {gf.radius || 100} m
              </Popup>
            </Circle>
          ))}
      </MapContainer>

      <div className="map-counter" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span>{validVehicles.length} vehículos con ubicación</span>
        {geofences.length > 0 && (
          <button
            type="button"
            onClick={() => setShowGeofences(!showGeofences)}
            style={{
              background: showGeofences ? 'var(--brand-teal)' : 'var(--bg-surface-alt)',
              color: showGeofences ? '#fff' : 'var(--text-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 8px',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Activar/Desactivar visualización de geocercas"
          >
            {showGeofences ? `Geocercas (${geofences.length})` : 'Mostrar Geocercas'}
          </button>
        )}
      </div>
    </div>
  )
}
