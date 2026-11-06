/**
 * DataTable.jsx — Tabla genérica con columnas configurables, paginación,
 * skeleton loader y estado vacío.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SkeletonTable } from './Skeleton'
import './DataTable.css'

/**
 * @typedef {{ key: string, label: string, render?: (row: object) => React.ReactNode }} Column
 *
 * @param {{
 *   columns: Column[],
 *   data: object[],
 *   loading?: boolean,
 *   page?: number,
 *   pages?: number,
 *   onPageChange?: (p: number) => void,
 *   emptyMessage?: string,
 *   emptyIcon?: React.ReactNode,
 *   rowKey?: (row: object) => string | number,
 * }} props
 */
export default function DataTable({
  columns,
  data,
  loading = false,
  page = 1,
  pages = 1,
  onPageChange,
  emptyMessage = 'No hay registros disponibles.',
  emptyIcon,
  rowKey,
}) {
  const showPagination = pages > 1 && !loading

  return (
    <div className="data-table-wrapper">
      <div className="data-table-scroll">
        <table className="data-table" role="table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} scope="col">{col.label}</th>
              ))}
            </tr>
          </thead>

          {loading ? (
            <SkeletonTable cols={columns.length} rows={6} />
          ) : data.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={columns.length}>
                  <div className="table-empty" role="status">
                    {emptyIcon && <div className="table-empty-icon">{emptyIcon}</div>}
                    <p>{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {data.map((row, idx) => (
                <tr key={rowKey ? rowKey(row) : idx}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>

      {showPagination && (
        <div className="table-pagination" role="navigation" aria-label="Paginación">
          <button
            type="button"
            className="page-btn"
            onClick={() => onPageChange?.(page - 1)}
            disabled={page <= 1}
            aria-label="Página anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="page-info">
            Página <strong>{page}</strong> de <strong>{pages}</strong>
          </span>
          <button
            type="button"
            className="page-btn"
            onClick={() => onPageChange?.(page + 1)}
            disabled={page >= pages}
            aria-label="Página siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
