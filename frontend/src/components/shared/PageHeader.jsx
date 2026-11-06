/**
 * PageHeader.jsx — Encabezado de página con título, subtítulo y slot de acciones.
 */

import './PageHeader.css'

/**
 * @param {{
 *   title: string,
 *   subtitle?: string,
 *   actions?: React.ReactNode,
 * }} props
 */
export default function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        <h1 className="page-header-title">{title}</h1>
        {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  )
}
