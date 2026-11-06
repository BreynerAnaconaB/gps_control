/**
 * Skeleton.jsx — Componente de skeleton loader para estados de carga.
 */

import './Skeleton.css'

/**
 * @param {{ width?: string, height?: string, borderRadius?: string, className?: string }} props
 */
export default function Skeleton({ width = '100%', height = '1rem', borderRadius = '4px', className = '' }) {
  return (
    <span
      className={`skeleton ${className}`}
      style={{ width, height, borderRadius }}
      aria-hidden="true"
    />
  )
}

/**
 * Fila de skeleton para tablas.
 * @param {{ cols?: number, rows?: number }} props
 */
export function SkeletonTable({ cols = 4, rows = 5 }) {
  return (
    <tbody aria-label="Cargando datos…">
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c} style={{ padding: '0.75rem 1rem' }}>
              <Skeleton height="0.9rem" width={c === 0 ? '70%' : '50%'} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}
