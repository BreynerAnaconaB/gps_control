import {
  LayoutDashboard,
  Map,
  Truck,
  Users,
  History,
  Settings,
  Radio,
} from 'lucide-react'

const menuItems = [
  { label: 'Resumen', icon: LayoutDashboard, active: true },
  { label: 'Monitoreo', icon: Map },
  { label: 'Vehículos', icon: Truck },
  { label: 'Conductores', icon: Users },
  { label: 'Historial', icon: History },
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">
          <Radio size={22} />
        </div>
        <div>
          <h2>GPS CONTROL</h2>
          <span>Fleet management</span>
        </div>
      </div>

      <span className="menu-label">MENÚ PRINCIPAL</span>

      <nav className="sidebar-nav">
        {menuItems.map(({ label, icon: Icon, active }) => (
          <button
            key={label}
            className={`nav-item ${active ? 'active' : ''}`}
            type="button"
          >
            <Icon size={19} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <button className="nav-item" type="button">
          <Settings size={19} />
          <span>Configuración</span>
        </button>

        <div className="user-profile">
          <div className="avatar">BC</div>
          <div>
            <strong>Administrador</strong>
            <span>GPS Control</span>
          </div>
        </div>
      </div>
    </aside>
  )
}