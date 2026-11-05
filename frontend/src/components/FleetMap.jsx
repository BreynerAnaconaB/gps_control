import { useEffect } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const vehicleIcon = L.divIcon({
  className: 'vehicle-marker',
  html: '<div class="marker-inner">🚚</div>',
  iconSize: [38, 38],
  iconAnchor: [19, 19],
})

function MapFocus({ vehicle }) {
  const map = useMap()

  useEffect(() => {
    if (vehicle?.latitude != null && vehicle?.longitude != null) {
      map.flyTo([vehicle.latitude, vehicle.longitude], 16, {
        duration: 1,
      })
    }
  }, [vehicle, map])

  return null
}

export default function FleetMap({ vehicles, selectedVehicle, onSelect }) {
  const validVehicles = vehicles.filter(
    (vehicle) =>
      Number.isFinite(vehicle.latitude) &&
      Number.isFinite(vehicle.longitude)
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

        {validVehicles.map((vehicle) => (
          <Marker
            key={vehicle.id}
            position={[vehicle.latitude, vehicle.longitude]}
            icon={vehicleIcon}
            eventHandlers={{
              click: () => onSelect(vehicle),
            }}
          >
            <Popup>
              <strong>{vehicle.name}</strong>
              <br />
              Velocidad: {vehicle.speed ?? 0} km/h
              <br />
              Altitud: {vehicle.altitude ?? 'N/D'} m
            </Popup>
          </Marker>
        ))}

        <MapFocus vehicle={selectedVehicle} />
      </MapContainer>

      <div className="map-counter">
        {validVehicles.length} vehículos con ubicación
      </div>
    </div>
  )
}