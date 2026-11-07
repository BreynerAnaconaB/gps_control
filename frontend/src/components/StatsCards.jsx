import {
  Truck,
  Activity,
  CircleParking,
  Signal,
  UserCheck,
  UserX,
  Users,
  Tag,
} from 'lucide-react'

export default function StatsCards({
  vehicles = [],
  driversCount = null,
  passengersCount = null,
  driversWithUnitCount = 0,
  onCardClick,
}) {
  const moving = vehicles.filter((v) => v.status === 'moving').length
  const stopped = vehicles.filter((v) => v.status === 'stopped').length
  const noSignal = vehicles.filter((v) => v.status === 'no_signal').length

  const vehicleWithDriver = vehicles.filter((v) => Boolean(v.assigned_driver_name)).length
  const withDriver = Math.max(vehicleWithDriver, driversWithUnitCount)
  const withoutDriver = Math.max(0, vehicles.length - withDriver)

  const stats = [
    {
      id: 'total_vehicles',
      label: 'Total vehículos',
      value: vehicles.length,
      icon: Truck,
      color: 'blue',
    },
    {
      id: 'moving',
      label: 'En movimiento',
      value: moving,
      icon: Activity,
      color: 'green',
    },
    {
      id: 'stopped',
      label: 'Detenidos',
      value: stopped,
      icon: CircleParking,
      color: 'orange',
    },
    {
      id: 'no_signal',
      label: 'Sin señal',
      value: noSignal,
      icon: Signal,
      color: 'purple',
    },
    {
      id: 'with_driver',
      label: 'Con conductor',
      value: withDriver,
      icon: UserCheck,
      color: 'green',
    },
    {
      id: 'without_driver',
      label: 'Sin conductor',
      value: withoutDriver,
      icon: UserX,
      color: 'orange',
    },
    ...(driversCount !== null
      ? [
          {
            id: 'total_drivers',
            label: 'Total conductores',
            value: driversCount,
            icon: Users,
            color: 'teal',
          },
        ]
      : []),
    ...(passengersCount !== null
      ? [
          {
            id: 'total_passengers',
            label: 'Total pasajeros',
            value: passengersCount,
            icon: Tag,
            color: 'teal',
          },
        ]
      : []),
  ]

  return (
    <section className="stats-grid" aria-label="Métricas de flota">
      {stats.map((stat) => {
        const { id, label, value, icon: Icon, color } = stat
        return (
          <article
            className="stat-card stat-card-interactive"
            key={id}
            onClick={() => onCardClick?.(stat)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onCardClick?.(stat)
              }
            }}
            title={`Clic para ver lista de ${label.toLowerCase()}`}
          >
            <div className={`stat-icon ${color}`}>
              <Icon size={20} />
            </div>

            <div className="stat-card-text">
              <span className="stat-card-label">{label}</span>
              <strong className="stat-card-value">{value}</strong>
            </div>

            <span className="stat-card-hint">Ver ↗</span>
          </article>
        )
      })}
    </section>
  )
}
