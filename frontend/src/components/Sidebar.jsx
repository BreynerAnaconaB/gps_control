import { Link, useLocation } from 'react-router-dom'
import {
  Map,
  Users,
  UserCheck,
  History,
  ShieldCheck,
  FileText,
  Radio,
  LogOut,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Sidebar({ isOpen = false, onClose = () => {} }) {
  const location = useLocation()
  const { user, logout, hasPermission } = useAuth()

  const currentPath = location.pathname

  const navItems = [
    {
      to: '/app',
      label: 'Monitoreo',
      icon: Map,
      show: true,
    },
    {
      to: '/app/drivers',
      label: 'Conductores',
      icon: Users,
      show: hasPermission('read', 'drivers'),
    },
    {
      to: '/app/passengers',
      label: 'Pasajeros',
      icon: UserCheck,
      show: hasPermission('read', 'passengers'),
    },
    {
      to: '/app/history',
      label: 'Historial',
      icon: History,
      show: hasPermission('read', 'history'),
    },
    {
      to: '/app/users',
      label: 'Usuarios',
      icon: ShieldCheck,
      show: hasPermission('manage', 'users'),
    },
    {
      to: '/app/audit',
      label: 'Auditoría',
      icon: FileText,
      show: hasPermission('read', 'audit'),
    },
  ]

  const userInitial = user?.email ? user.email.slice(0, 2).toUpperCase() : 'GC'

  return (
    <>
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <Link
            to="/"
            className="brand"
            onClick={onClose}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div className="brand-icon">
              <Radio size={22} />
            </div>
            <div>
              <h2>GPS CONTROL</h2>
              <span>Fleet management</span>
            </div>
          </Link>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Cerrar menú lateral"
          >
            <X size={20} />
          </button>
        </div>

        <span className="menu-label">MENÚ PRINCIPAL</span>

        <nav className="sidebar-nav" aria-label="Navegación del panel">
          {navItems
            .filter((item) => item.show)
            .map(({ to, label, icon: Icon }) => {
              const isActive = currentPath === to
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  style={{ textDecoration: 'none' }}
                >
                  <Icon size={19} />
                  <span>{label}</span>
                </Link>
              )
            })}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-profile">
            <div className="avatar">{userInitial}</div>
            <div style={{ overflow: 'hidden' }}>
              <strong style={{ display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {user?.email || 'Usuario'}
              </strong>
              <span style={{ textTransform: 'capitalize' }}>{user?.role || 'Operador'}</span>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={logout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#6b6b6b' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
