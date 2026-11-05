
import { Search, Truck, Gauge, Compass, ChevronLeft, ChevronRight } from 'lucide-react'

const statusLabels = {
  moving: 'En movimiento',
  stopped: 'Detenido',
  no_signal: 'Sin señal',
}

export default function VehicleList({
  vehicles,
  total,
  page,
  pages,
  search,
  status,
  onSearch,
  onStatusChange,
  onPageChange,
  selectedVehicle,
  onSelect,
}) {
  return (
    <aside className="vehicle-panel">
      <div className="panel-heading">
        <div>
          <h3>Vehículos</h3>
          <span>{total} registrados</span>
        </div>
      </div>

      <div className="search-box">
        <Search size={18} />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Buscar vehículo..."
        />
      </div>

      <div className="vehicle-filter">
        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          <option value="moving">En movimiento</option>
          <option value="stopped">Detenidos</option>
          <option value="no_signal">Sin señal</option>
        </select>
      </div>

      <div className="vehicle-list">
        {vehicles.map((vehicle) => (
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
                <i className={`status-dot ${vehicle.status}`} />
                {statusLabels[vehicle.status] || 'Desconocido'}
              </span>

              {vehicle.direction && (
                <small className="vehicle-direction">
                  <Compass size={12} />
                  {vehicle.direction}
                </small>
              )}
            </div>

            <div className="vehicle-speed">
              <Gauge size={14} />
              <strong>{vehicle.speed ?? 0}</strong>
              <small>km/h</small>
            </div>
          </button>
        ))}

        {vehicles.length === 0 && (
          <p className="empty-state">
            No se encontraron vehículos.
          </p>
        )}
      </div>

      <div className="pagination">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft size={18} />
        </button>

        <span>
          Página {page} de {pages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          aria-label="Página siguiente"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </aside>
  )
}
