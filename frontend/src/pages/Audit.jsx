import { useCallback, useEffect, useState } from 'react'
import { FileText, Filter, RefreshCw } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/shared/PageHeader'
import DataTable from '../components/shared/DataTable'
import ToastContainer from '../components/shared/Toast'
import { useToast } from '../components/shared/useToast'
import { getAuditLogs } from '../services/auditService'
import './Audit.css'

function getActionBadge(action) {
  let badgeClass = 'action-badge-default'
  if (action === 'login') badgeClass = 'action-badge-success'
  if (action === 'login_failed') badgeClass = 'action-badge-danger'
  if (action.includes('create')) badgeClass = 'action-badge-info'
  if (action.includes('update') || action.includes('change')) badgeClass = 'action-badge-warning'
  if (action.includes('delete')) badgeClass = 'action-badge-danger'

  return <span className={`audit-badge ${badgeClass}`}>{action}</span>
}

export default function Audit() {
  const { toasts, push: toast, remove: removeToast } = useToast()

  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [actionFilter, setActionFilter] = useState('')
  const [resourceFilter, setResourceFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getAuditLogs({
        page,
        pageSize: 15,
        action: actionFilter,
        resource: resourceFilter,
      })
      setLogs(data.items || [])
      setTotal(data.total || 0)
      setPages(data.pages || 1)
    } catch (err) {
      toast('error', err.message || 'Error al cargar registros de auditoría')
    } finally {
      setLoading(false)
    }
  }, [page, actionFilter, resourceFilter, toast])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const columns = [
    {
      key: 'created_at',
      label: 'Fecha y Hora (Colombia)',
      render: (row) => {
        if (!row.created_at) return '—'
        const d = new Date(row.created_at)
        return (
          <span style={{ fontSize: '0.85rem' }}>
            {d.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
          </span>
        )
      },
    },
    {
      key: 'user_email',
      label: 'Usuario',
      render: (row) => row.user_email || <span style={{ color: '#6b6b6b' }}>Sistema</span>,
    },
    {
      key: 'action',
      label: 'Acción realizada',
      render: (row) => getActionBadge(row.action),
    },
    {
      key: 'resource',
      label: 'Módulo / Recurso',
      render: (row) => (
        <span style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: '#1e8c93' }}>
          {row.resource}
        </span>
      ),
    },
    {
      key: 'detail',
      label: 'Detalles del evento',
      render: (row) => (
        <small style={{ color: '#6b6b6b', wordBreak: 'break-all' }}>
          {row.detail || '—'}
        </small>
      ),
    },
    {
      key: 'ip_address',
      label: 'Dirección IP',
      render: (row) => (
        <code className="audit-ip-code">
          {row.ip_address || '—'}
        </code>
      ),
    },
  ]

  return (
    <AppLayout
      title="Registro de Auditoría"
      breadcrumb="GPS Control / Auditoría"
      onRefresh={loadLogs}
      isRefreshing={loading}
    >
      <div className="audit-content">
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        <PageHeader
          title="Auditoría del Sistema"
          subtitle={`Histórico de acciones de seguridad y operaciones del sistema (${total} eventos)`}
          actions={
            <button type="button" className="btn-secondary" onClick={loadLogs}>
              <RefreshCw size={16} /> Refrescar
            </button>
          }
        />

        <div className="audit-content">
          <div className="audit-filters-bar">
            <div className="audit-filter-item">
              <Filter size={15} />
              <label htmlFor="filter-action">Filtrar por acción:</label>
              <select
                id="filter-action"
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">Todas las acciones</option>
                <option value="login">Inicios de sesión</option>
                <option value="login_failed">Intentos fallidos de login</option>
                <option value="create_user">Creación de usuarios</option>
                <option value="update_user">Edición de usuarios</option>
                <option value="change_password">Cambio de contraseña</option>
                <option value="create_driver">Creación de conductores</option>
                <option value="delete_driver">Eliminación de conductores</option>
              </select>
            </div>

            <div className="audit-filter-item">
              <label htmlFor="filter-resource">Módulo:</label>
              <select
                id="filter-resource"
                value={resourceFilter}
                onChange={(e) => {
                  setResourceFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">Todos los recursos</option>
                <option value="auth">Autenticación</option>
                <option value="users">Usuarios</option>
                <option value="drivers">Conductores</option>
                <option value="passengers">Pasajeros</option>
                <option value="vehicles">Vehículos</option>
              </select>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={logs}
            loading={loading}
            page={page}
            pages={pages}
            onPageChange={setPage}
            emptyMessage="No hay registros de auditoría que coincidan con los filtros."
            emptyIcon={<FileText size={36} />}
            rowKey={(r) => r.id}
          />
        </div>
      </div>
    </AppLayout>
  )
}

