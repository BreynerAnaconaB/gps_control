import { useState } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function AppLayout({
  title,
  breadcrumb,
  actions = null,
  onRefresh = null,
  isRefreshing = false,
  children,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-layout-container">
        <TopBar
          title={title}
          breadcrumb={breadcrumb}
          actions={actions}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          isSidebarOpen={sidebarOpen}
        />
        <main className="main-page-body">
          {children}
        </main>
      </div>
    </div>
  )
}

