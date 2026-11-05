
import {
  Truck,
  Activity,
  CircleParking,
  Signal,
} from 'lucide-react'

export default function StatsCards({ vehicles }) {
  const moving = vehicles.filter(
    (vehicle) => vehicle.status === 'moving'
  ).length

  const stopped = vehicles.filter(
    (vehicle) => vehicle.status === 'stopped'
  ).length

  const noSignal = vehicles.filter(
    (vehicle) => vehicle.status === 'no_signal'
  ).length

  const stats = [
    {
      label: 'Total vehículos',
      value: vehicles.length,
      icon: Truck,
      color: 'blue',
    },
    {
      label: 'En movimiento',
      value: moving,
      icon: Activity,
      color: 'green',
    },
    {
      label: 'Detenidos',
      value: stopped,
      icon: CircleParking,
      color: 'orange',
    },
    {
      label: 'Sin señal',
      value: noSignal,
      icon: Signal,
      color: 'purple',
    },
  ]

  return (
    <section className="stats-grid">
      {stats.map(({ label, value, icon: Icon, color }) => (
        <article className="stat-card" key={label}>
          <div className={`stat-icon ${color}`}>
            <Icon size={21} />
          </div>

          <div>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        </article>
      ))}
    </section>
  )
}
