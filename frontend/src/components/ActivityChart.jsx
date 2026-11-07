/**
 * ActivityChart.jsx — Gráfica de barras horizontales SVG pura.
 * Muestra top 5 vehículos por velocidad actual. Adaptada a temas claro/oscuro.
 */

import './ActivityChart.css'

const BAR_COLORS = ['#EB162C', '#1E8C93', '#A81A2B', '#167278', '#6B6B6B']

export default function ActivityChart({ vehicles }) {
  const top5 = [...vehicles]
    .filter((v) => typeof v.speed === 'number')
    .sort((a, b) => b.speed - a.speed)
    .slice(0, 5)

  const maxSpeed = top5.length > 0 ? Math.max(...top5.map((v) => v.speed), 1) : 1

  const SVG_W   = 320
  const BAR_H   = 22
  const BAR_GAP = 10
  const LABEL_W = 95
  const CHART_W = SVG_W - LABEL_W - 55
  const SVG_H   = top5.length * (BAR_H + BAR_GAP) + BAR_GAP

  if (top5.length === 0) {
    return (
      <div className="activity-chart activity-chart-empty">
        <span>Sin datos de velocidad disponibles.</span>
      </div>
    )
  }

  return (
    <div className="activity-chart" role="img" aria-label="Top 5 vehículos por velocidad">
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width="100%"
        style={{ maxWidth: SVG_W }}
        aria-hidden="true"
      >
        {top5.map((v, i) => {
          const barW  = Math.max(3, (v.speed / maxSpeed) * CHART_W)
          const y     = BAR_GAP + i * (BAR_H + BAR_GAP)
          const color = BAR_COLORS[i % BAR_COLORS.length]
          const name  = v.name?.length > 12 ? v.name.slice(0, 11) + '…' : (v.name ?? '—')
          return (
            <g key={v.id}>
              {/* Vehicle name label */}
              <text
                x={LABEL_W - 8}
                y={y + BAR_H / 2 + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--text-secondary)"
                fontWeight="600"
              >
                {name}
              </text>
              {/* Speed bar */}
              <rect
                x={LABEL_W}
                y={y}
                width={barW}
                height={BAR_H}
                fill={color}
                rx={4}
              />
              {/* Speed text value */}
              <text
                x={LABEL_W + barW + 8}
                y={y + BAR_H / 2 + 4}
                fontSize="11"
                fill="var(--text-primary)"
                fontWeight="700"
              >
                {v.speed} km/h
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
