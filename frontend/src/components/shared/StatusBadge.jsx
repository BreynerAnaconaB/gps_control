/**
 * StatusBadge.jsx — Badge coloreado según el estado del vehículo.
 */

import './StatusBadge.css'

const STATUS_MAP = {
  moving:    { label: 'En movimiento', className: 'badge-moving' },
  stopped:   { label: 'Detenido',      className: 'badge-stopped' },
  no_signal: { label: 'Sin señal',     className: 'badge-no-signal' },
  active:    { label: 'Activo',        className: 'badge-active' },
  inactive:  { label: 'Inactivo',      className: 'badge-inactive' },
}

/**
 * @param {{ status: string, label?: string }} props
 */
export default function StatusBadge({ status, label }) {
  const config = STATUS_MAP[status] ?? { label: status, className: 'badge-default' }
  return (
    <span className={`status-badge ${config.className}`}>
      {label ?? config.label}
    </span>
  )
}
