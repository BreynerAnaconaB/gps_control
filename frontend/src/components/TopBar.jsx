import { Moon, Sun, RefreshCw, Bell, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import './TopBar.css'

export default function TopBar({
  title = 'Panel de control',
  breadcrumb = 'GPS Control / Monitoreo',
  actions = null,
  onRefresh = null,
  isRefreshing = false,
  onToggleSidebar = null,
  isSidebarOpen = false,
}) {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const roleLabels = {
    admin: 'Admin',
    operator: 'Operador',
    viewer: 'Visualizador',
  }

  const roleName = user?.role ? roleLabels[user.role.toLowerCase()] || user.role : 'Usuario'

  return (
    <header className="topbar">
      <div className="topbar-left">
        {onToggleSidebar && (
          <button
            type="button"
            className="topbar-hamburger-btn"
            onClick={onToggleSidebar}
            aria-label={isSidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
            title="Menú de navegación"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        )}
        <div className="topbar-heading">
          <span className="topbar-breadcrumb">{breadcrumb}</span>
          <h1 className="topbar-title">{title}</h1>
        </div>
      </div>

      <div className="topbar-right">
        {/* Connection status indicator */}
        <div className="connection-pill" title="Conexión activa con API Wialon">
          <span className="connection-dot" aria-hidden="true" />
          <span className="connection-text">Wialon Online</span>
        </div>

        {/* Page-specific actions (e.g., Export CSV) */}
        {actions && <div className="topbar-custom-actions">{actions}</div>}

        {/* Refresh button */}
        {onRefresh && (
          <button
            type="button"
            className="topbar-icon-btn"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Actualizar datos"
            aria-label="Actualizar datos"
          >
            <RefreshCw size={17} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        )}

        {/* Dark/Light mode toggle */}
        <button
          type="button"
          className="topbar-icon-btn theme-toggle-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label="Cambiar tema de color"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* User badge */}
        <div className="topbar-user-badge">
          <span className="user-email">{user?.email || 'admin@gpscontrol.co'}</span>
          <span className={`user-role-tag ${user?.role?.toLowerCase() || 'admin'}`}>
            {roleName}
          </span>
        </div>

        {/* Notification bell */}
        <button
          type="button"
          className="topbar-icon-btn"
          title="Notificaciones"
          aria-label="Ver notificaciones"
        >
          <Bell size={17} />
        </button>

        {/* Logout button */}
        <button
          type="button"
          className="topbar-icon-btn logout-btn"
          onClick={logout}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <LogOut size={17} />
        </button>
      </div>
    </header>
  )
}

