/**
 * StatusChart.jsx — Gráfica de dona SVG pura para moving/stopped/no_signal.
 * Sin dependencias externas. Accesible con roles ARIA y adaptada a temas claro/oscuro.
 */

import './StatusChart.css'

const SEGMENTS = [
  { key: 'moving',    label: 'En movimiento', color: '#1E8C93' },
  { key: 'stopped',   label: 'Detenidos',     color: '#EB162C' },
  { key: 'no_signal', label: 'Sin señal',      color: '#6B6B6B' },
]

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

function arcPath(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end   = polarToCartesian(cx, cy, r, startAngle)
  const large = endAngle - startAngle > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`
}

export default function StatusChart({ vehicles }) {
  const total = vehicles.length

  const counts = {
    moving:    vehicles.filter((v) => v.status === 'moving').length,
    stopped:   vehicles.filter((v) => v.status === 'stopped').length,
    no_signal: vehicles.filter((v) => v.status === 'no_signal').length,
  }

  const SIZE   = 160
  const CX     = SIZE / 2
  const CY     = SIZE / 2
  const R      = 60
  const INNER  = 36

  /* Build arc paths */
  let currentAngle = 0
  const arcs = []
  for (const seg of SEGMENTS) {
    const value = counts[seg.key] ?? 0
    const sweep = total > 0 ? (value / total) * 360 : 0
    const endAngle = currentAngle + sweep
    const path = sweep > 0 ? arcPath(CX, CY, R, currentAngle, endAngle) : null
    arcs.push({ ...seg, value, sweep, path, startAngle: currentAngle, endAngle })
    currentAngle = endAngle
  }

  return (
    <div className="status-chart" role="img" aria-label="Distribución de estado de flota">
      <div className="status-chart-donut">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={SIZE}
          height={SIZE}
          aria-hidden="true"
        >
          {total === 0 ? (
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke="var(--border-default)"
              strokeWidth={INNER - 4}
            />
          ) : (
            arcs.map(({ key, color, path }) =>
              path ? (
                <path
                  key={key}
                  d={path}
                  fill="none"
                  stroke={color}
                  strokeWidth={INNER - 4}
                  strokeLinecap="butt"
                />
              ) : null
            )
          )}
          {/* Inner hole label */}
          <text
            x={CX}
            y={CY - 6}
            textAnchor="middle"
            fontSize="22"
            fontWeight="800"
            fill="var(--text-primary)"
          >
            {total}
          </text>
          <text
            x={CX}
            y={CY + 12}
            textAnchor="middle"
            fontSize="9"
            fill="var(--text-muted)"
            fontWeight="700"
            letterSpacing="0.08em"
          >
            VEHÍCULOS
          </text>
        </svg>
      </div>

      <ul className="status-chart-legend" role="list">
        {SEGMENTS.map(({ key, label, color }) => {
          const value = counts[key] ?? 0
          const pct   = total > 0 ? Math.round((value / total) * 100) : 0
          return (
            <li key={key} className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: color }} aria-hidden="true" />
              <span className="legend-label">{label}</span>
              <span className="legend-count">{value}</span>
              <span className="legend-pct">({pct}%)</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
