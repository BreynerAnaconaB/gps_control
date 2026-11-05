import { Truck, Activity, CircleParking, Signal } from 'lucide-react'

export default function StatsCards({ vehicles }) {
  const moving = vehicles.filter((v) => (v.speed ?? 0) > 0).length
  const stopped = vehicles.length - moving

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
      label: 'Con ubicación GPS',
      value: vehicles.filter(
        (v) => v.latitude != null && v.longitude != null
      ).length,
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