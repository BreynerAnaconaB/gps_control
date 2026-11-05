import { useState } from 'react'
import { Search, Truck, Gauge } from 'lucide-react'

export default function VehicleList({ vehicles, selectedVehicle, onSelect }) {
  const [search, setSearch] = useState('')

  const filteredVehicles = vehicles.filter((vehicle) =>
    vehicle.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <aside className="vehicle-panel">
      <div className="panel-heading">
        <div>
          <h3>Vehículos</h3>
          <span>{vehicles.length} registrados</span>
        </div>
      </div>

      <div className="search-box">
        <Search size={18} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar vehículo..."
        />
      </div>

      <div className="vehicle-list">
        {filteredVehicles.map((vehicle) => {
          const moving = (vehicle.speed ?? 0) > 0

          return (
            <button
              type="button"
              key={vehicle.id}
              className={`vehicle-item ${
                selectedVehicle?.id === vehicle.id ? 'selected' : ''
              }`}
              onClick={() => onSelect(vehicle)}
            >
              <div className="vehicle-avatar">
                <Truck size={20} />
              </div>

              <div className="vehicle-info">
                <strong>{vehicle.name}</strong>
                <span>
                  <i className={moving ? 'status-dot moving' : 'status-dot'} />
                  {moving ? 'En movimiento' : 'Detenido'}
                </span>
              </div>

              <div className="vehicle-speed">
                <Gauge size={14} />
                <strong>{vehicle.speed ?? 0}</strong>
                <small>km/h</small>
              </div>
            </button>
          )
        })}

        {filteredVehicles.length === 0 && (
          <p className="empty-state">No se encontraron vehículos.</p>
        )}
      </div>
    </aside>
  )
}