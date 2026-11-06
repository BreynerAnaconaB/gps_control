import { useCallback, useEffect, useState } from 'react'
import {
  Users,
  Plus,
  Download,
  Search,
  Edit2,
  Trash2,
  Link as LinkIcon,
  Unlink,
} from 'lucide-react'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/shared/PageHeader'
import DataTable from '../components/shared/DataTable'
import Modal from '../components/shared/Modal'
import ConfirmDialog from '../components/shared/ConfirmDialog'
import ToastContainer from '../components/shared/Toast'
import { useToast } from '../components/shared/useToast'
import RoleGuard from '../components/RoleGuard'
import {
  getDrivers,
  createDriver,
  updateDriver,
  deleteDriver,
  bindDriver,
  unbindDriver,
  exportDriversCsv,
} from '../services/driverService'
import { getAllVehicles } from '../services/vehicleService'
import './Drivers.css'

const STATUS_LABELS = {
  moving: 'En movimiento',
  stopped: 'Detenido',
  no_signal: 'Sin señal',
}

function formatStatus(status) {
  return STATUS_LABELS[status] || status || ''
}

export default function Drivers() {
  const { toasts, push: toast, remove: removeToast } = useToast()

  const [drivers, setDrivers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // Vehículos para el selector de vinculación
  const [vehicles, setVehicles] = useState([])

  // Modal crear/editar
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingDriver, setEditingDriver] = useState(null)
  const [formName, setFormName] = useState('')
  const [formCode, setFormCode] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)

  // Modal vincular
  const [bindModalOpen, setBindModalOpen] = useState(false)
  const [bindTargetDriver, setBindTargetDriver] = useState(null)
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [bindSubmitting, setBindSubmitting] = useState(false)

  // Dialog confirmar eliminación
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingDriver, setDeletingDriver] = useState(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  const loadDrivers = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getDrivers({ page, pageSize: 10, search })
      setDrivers(data.items || [])
      setTotal(data.total || 0)
      setPages(data.pages || 1)
    } catch (err) {
      toast('error', err.message || 'Error al cargar conductores')
    } finally {
      setLoading(false)
    }
  }, [page, search, toast])

  useEffect(() => {
    loadDrivers()
  }, [loadDrivers])

  // Carga lista de vehículos para el modal de vincular
  useEffect(() => {
    getAllVehicles()
      .then((data) => setVehicles(data || []))
      .catch(() => {})
  }, [])

  function openCreateModal() {
    setEditingDriver(null)
    setFormName('')
    setFormCode('')
    setFormPhone('')
    setEditModalOpen(true)
  }

  function openEditModal(driver) {
    setEditingDriver(driver)
    setFormName(driver.name || '')
    setFormCode(driver.code || '')
    setFormPhone(driver.phone || '')
    setEditModalOpen(true)
  }

  async function handleFormSubmit(e) {
    e.preventDefault()
    if (!formName.trim()) {
      toast('warning', 'El nombre es obligatorio')
      return
    }

    try {
      setFormSubmitting(true)
      const payload = {
        name: formName.trim(),
        code: formCode.trim(),
        phone: formPhone.trim(),
      }

      if (editingDriver) {
        await updateDriver(editingDriver.id, payload)
        toast('success', 'Conductor actualizado en Wialon')
      } else {
        await createDriver(payload)
        toast('success', 'Conductor registrado en Wialon')
      }

      setEditModalOpen(false)
      loadDrivers()
    } catch (err) {
      toast('error', err.message || 'Error al guardar conductor')
    } finally {
      setFormSubmitting(false)
    }
  }

  function openDeleteDialog(driver) {
    setDeletingDriver(driver)
    setDeleteDialogOpen(true)
  }

  async function handleDeleteConfirm() {
    if (!deletingDriver) return
    try {
      setDeleteSubmitting(true)
      await deleteDriver(deletingDriver.id)
      toast('success', 'Conductor eliminado correctamente')
      setDeleteDialogOpen(false)
      loadDrivers()
    } catch (err) {
      toast('error', err.message || 'Error al eliminar conductor')
    } finally {
      setDeleteSubmitting(false)
    }
  }

  function openBindModal(driver) {
    setBindTargetDriver(driver)
    setSelectedUnitId(driver.assigned_unit_id ? String(driver.assigned_unit_id) : '')
    setBindModalOpen(true)
  }

  async function handleBindSubmit(e) {
    e.preventDefault()
    if (!bindTargetDriver) return
    try {
      setBindSubmitting(true)
      if (selectedUnitId) {
        await bindDriver(bindTargetDriver.id, selectedUnitId)
        toast('success', 'Conductor asignado al vehículo en Wialon')
      } else if (bindTargetDriver.assigned_unit_id) {
        await unbindDriver(bindTargetDriver.id, bindTargetDriver.assigned_unit_id)
        toast('success', 'Conductor desvinculado de la unidad')
      }
      setBindModalOpen(false)
      loadDrivers()
    } catch (err) {
      toast('error', err.message || 'Error al vincular conductor')
    } finally {
      setBindSubmitting(false)
    }
  }

  async function handleExport() {
    try {
      await exportDriversCsv()
      toast('success', 'CSV descargado con éxito')
    } catch (err) {
      toast('error', err.message || 'Error al exportar')
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Nombre completo',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div className="driver-avatar">{row.name.slice(0, 2).toUpperCase()}</div>
          <div>
            <strong>{row.name}</strong>
            {row.phone && <small style={{ display: 'block', color: '#6b6b6b' }}>{row.phone}</small>}
          </div>
        </div>
      ),
    },
    {
      key: 'code',
      label: 'Código / Cédula',
      render: (row) => row.code || <span style={{ color: '#6b6b6b' }}>—</span>,
    },
    {
      key: 'assigned_unit_id',
      label: 'Vehículo asignado',
      render: (row) => {
        if (!row.assigned_unit_id) {
          return <span className="unassigned-badge">Sin asignar</span>
        }
        const unit = vehicles.find((v) => v.id === row.assigned_unit_id)
        return (
          <span className="assigned-badge">
            🚚 {unit?.name || `Unidad #${row.assigned_unit_id}`}
          </span>
        )
      },
    },
    {
      key: 'actions',
      label: 'Acciones',
      render: (row) => (
        <div className="action-buttons">
          <RoleGuard action="write" resource="drivers">
            <button
              type="button"
              className="action-btn"
              onClick={() => openBindModal(row)}
              title="Vincular / Desvincular unidad"
              aria-label="Vincular conductor"
            >
              {row.assigned_unit_id ? <Unlink size={16} /> : <LinkIcon size={16} />}
            </button>
            <button
              type="button"
              className="action-btn"
              onClick={() => openEditModal(row)}
              title="Editar conductor"
              aria-label="Editar conductor"
            >
              <Edit2 size={16} />
            </button>
            <button
              type="button"
              className="action-btn delete"
              onClick={() => openDeleteDialog(row)}
              title="Eliminar conductor"
              aria-label="Eliminar conductor"
            >
              <Trash2 size={16} />
            </button>
          </RoleGuard>
        </div>
      ),
    },
  ]

  return (
    <AppLayout
      title="Gestión de Conductores"
      breadcrumb="GPS Control / Conductores"
      onRefresh={loadDrivers}
      isRefreshing={loading}
    >
      <div className="drivers-content">
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        <PageHeader
          title="Gestión de Conductores"
          subtitle={`Total de conductores: ${total} · Sincronizado en tiempo real con Wialon`}
          actions={
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <RoleGuard action="export" resource="data">
                <button type="button" className="btn-secondary" onClick={handleExport}>
                  <Download size={16} /> Exportar CSV
                </button>
              </RoleGuard>

              <RoleGuard action="write" resource="drivers">
                <button type="button" className="btn-primary" onClick={openCreateModal}>
                  <Plus size={16} /> Nuevo Conductor
                </button>
              </RoleGuard>
            </div>
          }
        />

        <div className="drivers-content">
          <div className="drivers-search-row">
            <div className="search-input-wrapper">
              <Search size={18} />
              <input
                type="text"
                placeholder="Buscar por nombre o código..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                aria-label="Buscar conductores"
              />
            </div>
          </div>

          <DataTable
            columns={columns}
            data={drivers}
            loading={loading}
            page={page}
            pages={pages}
            onPageChange={setPage}
            emptyMessage="No se encontraron conductores registrados."
            emptyIcon={<Users size={36} />}
            rowKey={(r) => r.id}
          />
        </div>

        {/* Modal Crear / Editar */}
        <Modal
          open={editModalOpen}
          title={editingDriver ? 'Editar Conductor' : 'Registrar Nuevo Conductor'}
          onClose={() => setEditModalOpen(false)}
        >
          <form onSubmit={handleFormSubmit} className="modal-form">
            <div className="form-group">
              <label htmlFor="driver-name">Nombre completo *</label>
              <input
                id="driver-name"
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ej. Carlos Mendoza"
                disabled={formSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="driver-code">Código de identificación / Cédula</label>
              <input
                id="driver-code"
                type="text"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="Ej. CC 10203040"
                disabled={formSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="driver-phone">Teléfono de contacto</label>
              <input
                id="driver-phone"
                type="text"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="Ej. +57 300 123 4567"
                disabled={formSubmitting}
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setEditModalOpen(false)}
                disabled={formSubmitting}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={formSubmitting}>
                {formSubmitting ? 'Guardando...' : editingDriver ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal Vincular */}
        <Modal
          open={bindModalOpen}
          title={`Vincular Conductor: ${bindTargetDriver?.name || ''}`}
          onClose={() => setBindModalOpen(false)}
        >
          <form onSubmit={handleBindSubmit} className="modal-form">
            <p style={{ color: '#6b6b6b', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Selecciona el vehículo al que deseas asignar este conductor. Si dejas la opción
              en blanco, el conductor quedará desvinculado.
            </p>

            <div className="form-group">
              <label htmlFor="select-unit">Vehículo de la flota</label>
              <select
                id="select-unit"
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                disabled={bindSubmitting}
              >
                <option value="">-- Sin vehículo (Desvincular) --</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}{v.plate && v.plate !== v.name ? ` (${v.plate})` : ''} — {formatStatus(v.status)}
                  </option>
                ))}
              </select>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setBindModalOpen(false)}
                disabled={bindSubmitting}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={bindSubmitting}>
                {bindSubmitting ? 'Guardando...' : 'Aplicar cambio'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Confirmar Eliminación */}
        <ConfirmDialog
          open={deleteDialogOpen}
          title="Eliminar conductor"
          message={`¿Estás seguro de eliminar al conductor "${deletingDriver?.name}"? Esta acción se sincronizará con Wialon.`}
          confirmLabel="Eliminar"
          danger
          loading={deleteSubmitting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteDialogOpen(false)}
        />
      </div>
    </AppLayout>
  )
}

