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
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-layout-container">
        <TopBar
          title={title}
          breadcrumb={breadcrumb}
          actions={actions}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
        />
        <main className="main-page-body">
          {children}
        </main>
      </div>
    </div>
  )
}

