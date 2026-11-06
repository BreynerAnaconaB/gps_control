import { useCallback, useEffect, useState } from 'react'
import {
  UserCheck,
  Plus,
  Download,
  Search,
  Edit2,
  Trash2,
  Link as LinkIcon,
  Unlink,
  X,
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
  getPassengers,
  createPassenger,
  updatePassenger,
  deletePassenger,
  bindPassenger,
  unbindPassenger,
  exportPassengersCsv,
} from '../services/passengerService'
import { getAllVehicles } from '../services/vehicleService'
import './Passengers.css'

const STATUS_LABELS = {
  moving: 'En movimiento',
  stopped: 'Detenido',
  no_signal: 'Sin señal',
}

function formatStatus(status) {
  return STATUS_LABELS[status] || status || ''
}

export default function Passengers() {
  const { toasts, push: toast, remove: removeToast } = useToast()

  const [passengers, setPassengers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // Vehículos para asignación
  const [vehicles, setVehicles] = useState([])

  // Modal crear/editar
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingPassenger, setEditingPassenger] = useState(null)
  const [formName, setFormName] = useState('')
  const [formCode, setFormCode] = useState('')
  const [customFields, setCustomFields] = useState([]) // [{ key: '', value: '' }]
  const [formSubmitting, setFormSubmitting] = useState(false)

  // Modal vincular
  const [bindModalOpen, setBindModalOpen] = useState(false)
  const [bindTarget, setBindTarget] = useState(null)
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [bindSubmitting, setBindSubmitting] = useState(false)

  // ConfirmDialog eliminar
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingPassenger, setDeletingPassenger] = useState(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  const loadPassengers = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getPassengers({ page, pageSize: 10, search })
      setPassengers(data.items || [])
      setTotal(data.total || 0)
      setPages(data.pages || 1)
    } catch (err) {
      toast('error', err.message || 'Error al cargar pasajeros')
    } finally {
      setLoading(false)
    }
  }, [page, search, toast])

  useEffect(() => {
    loadPassengers()
  }, [loadPassengers])

  useEffect(() => {
    getAllVehicles()
      .then((data) => setVehicles(data || []))
      .catch(() => {})
  }, [])

  function openCreateModal() {
    setEditingPassenger(null)
    setFormName('')
    setFormCode('')
    setCustomFields([])
    setEditModalOpen(true)
  }

  function openEditModal(passenger) {
    setEditingPassenger(passenger)
    setFormName(passenger.name || '')
    setFormCode(passenger.code || '')
    const fields = Object.entries(passenger.custom_params || {}).map(([key, value]) => ({
      key,
      value: String(value),
    }))
    setCustomFields(fields)
    setEditModalOpen(true)
  }

  function addCustomFieldRow() {
    setCustomFields((prev) => [...prev, { key: '', value: '' }])
  }

  function updateCustomFieldRow(index, field, val) {
    setCustomFields((prev) => {
      const copy = [...prev]
      copy[index][field] = val
      return copy
    })
  }

  function removeCustomFieldRow(index) {
    setCustomFields((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleFormSubmit(e) {
    e.preventDefault()
    if (!formName.trim()) {
      toast('warning', 'El nombre es obligatorio')
      return
    }

    const customParamsObj = {}
    customFields.forEach(({ key, value }) => {
      if (key.trim()) {
        customParamsObj[key.trim()] = value.trim()
      }
    })

    try {
      setFormSubmitting(true)
      const payload = {
        name: formName.trim(),
        code: formCode.trim(),
        custom_params: customParamsObj,
      }

      if (editingPassenger) {
        await updatePassenger(editingPassenger.id, payload)
        toast('success', 'Pasajero actualizado en Wialon')
      } else {
        await createPassenger(payload)
        toast('success', 'Pasajero registrado en Wialon')
      }

      setEditModalOpen(false)
      loadPassengers()
    } catch (err) {
      toast('error', err.message || 'Error al guardar pasajero')
    } finally {
      setFormSubmitting(false)
    }
  }

  function openDeleteDialog(passenger) {
    setDeletingPassenger(passenger)
    setDeleteDialogOpen(true)
  }

  async function handleDeleteConfirm() {
    if (!deletingPassenger) return
    try {
      setDeleteSubmitting(true)
      await deletePassenger(deletingPassenger.id)
      toast('success', 'Pasajero eliminado en Wialon')
      setDeleteDialogOpen(false)
      loadPassengers()
    } catch (err) {
      toast('error', err.message || 'Error al eliminar pasajero')
    } finally {
      setDeleteSubmitting(false)
    }
  }

  function openBindModal(passenger) {
    setBindTarget(passenger)
    setSelectedUnitId(passenger.assigned_unit_id ? String(passenger.assigned_unit_id) : '')
    setBindModalOpen(true)
  }

  async function handleBindSubmit(e) {
    e.preventDefault()
    if (!bindTarget) return
    try {
      setBindSubmitting(true)
      if (selectedUnitId) {
        await bindPassenger(bindTarget.id, selectedUnitId)
        toast('success', 'Pasajero asignado al vehículo en Wialon')
      } else if (bindTarget.assigned_unit_id) {
        await unbindPassenger(bindTarget.id, bindTarget.assigned_unit_id)
        toast('success', 'Pasajero desvinculado del vehículo')
      }
      setBindModalOpen(false)
      loadPassengers()
    } catch (err) {
      toast('error', err.message || 'Error al vincular pasajero')
    } finally {
      setBindSubmitting(false)
    }
  }

  async function handleExport() {
    try {
      await exportPassengersCsv()
      toast('success', 'CSV descargado con éxito')
    } catch (err) {
      toast('error', err.message || 'Error al exportar')
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Nombre del pasajero',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div className="passenger-avatar">{row.name.slice(0, 2).toUpperCase()}</div>
          <strong>{row.name}</strong>
        </div>
      ),
    },
    {
      key: 'code',
      label: 'Código / Etiqueta',
      render: (row) => row.code || <span style={{ color: '#6b6b6b' }}>—</span>,
    },
    {
      key: 'custom_params',
      label: 'Campos personalizados',
      render: (row) => {
        const count = Object.keys(row.custom_params || {}).length
        if (count === 0) return <span style={{ color: '#6b6b6b' }}>Sin campos</span>
        return (
          <span className="custom-fields-pill">
            {count} campo{count > 1 ? 's' : ''}
          </span>
        )
      },
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
          <RoleGuard action="write" resource="passengers">
            <button
              type="button"
              className="action-btn"
              onClick={() => openBindModal(row)}
              title="Vincular a vehículo"
              aria-label="Vincular pasajero"
            >
              {row.assigned_unit_id ? <Unlink size={16} /> : <LinkIcon size={16} />}
            </button>
            <button
              type="button"
              className="action-btn"
              onClick={() => openEditModal(row)}
              title="Editar pasajero"
              aria-label="Editar pasajero"
            >
              <Edit2 size={16} />
            </button>
            <button
              type="button"
              className="action-btn delete"
              onClick={() => openDeleteDialog(row)}
              title="Eliminar pasajero"
              aria-label="Eliminar pasajero"
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
      title="Gestión de Pasajeros"
      breadcrumb="GPS Control / Pasajeros"
      onRefresh={loadPassengers}
      isRefreshing={loading}
    >
      <div className="passengers-content">
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        <PageHeader
          title="Gestión de Pasajeros"
          subtitle={`Total de pasajeros: ${total} · Persistencia sincronizada en Wialon`}
          actions={
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <RoleGuard action="export" resource="data">
                <button type="button" className="btn-secondary" onClick={handleExport}>
                  <Download size={16} /> Exportar CSV
                </button>
              </RoleGuard>

              <RoleGuard action="write" resource="passengers">
                <button type="button" className="btn-primary" onClick={openCreateModal}>
                  <Plus size={16} /> Nuevo Pasajero
                </button>
              </RoleGuard>
            </div>
          }
        />

        <div className="passengers-content">
          <div className="passengers-search-row">
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
                aria-label="Buscar pasajeros"
              />
            </div>
          </div>

          <DataTable
            columns={columns}
            data={passengers}
            loading={loading}
            page={page}
            pages={pages}
            onPageChange={setPage}
            emptyMessage="No se encontraron pasajeros registrados."
            emptyIcon={<UserCheck size={36} />}
            rowKey={(r) => r.id}
          />
        </div>

        {/* Modal Crear / Editar */}
        <Modal
          open={editModalOpen}
          title={editingPassenger ? 'Editar Pasajero' : 'Registrar Nuevo Pasajero'}
          onClose={() => setEditModalOpen(false)}
          size="md"
        >
          <form onSubmit={handleFormSubmit} className="modal-form">
            <div className="form-group">
              <label htmlFor="passenger-name">Nombre del pasajero *</label>
              <input
                id="passenger-name"
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ej. Ana Lucía Gómez"
                disabled={formSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="passenger-code">Código de identificación</label>
              <input
                id="passenger-code"
                type="text"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="Ej. TAG-8801"
                disabled={formSubmitting}
              />
            </div>

            <div className="custom-fields-editor">
              <div className="custom-fields-header">
                <strong>Campos personalizados</strong>
                <button
                  type="button"
                  className="btn-add-field"
                  onClick={addCustomFieldRow}
                  disabled={formSubmitting}
                >
                  <Plus size={14} /> Agregar campo
                </button>
              </div>

              {customFields.length === 0 ? (
                <small style={{ color: '#6b6b6b' }}>
                  Sin campos adicionales (empresa, ruta, cargo, etc.)
                </small>
              ) : (
                customFields.map((f, i) => (
                  <div key={i} className="custom-field-row">
                    <input
                      type="text"
                      placeholder="Nombre del campo (ej. Empresa)"
                      value={f.key}
                      onChange={(e) => updateCustomFieldRow(i, 'key', e.target.value)}
                      disabled={formSubmitting}
                    />
                    <input
                      type="text"
                      placeholder="Valor"
                      value={f.value}
                      onChange={(e) => updateCustomFieldRow(i, 'value', e.target.value)}
                      disabled={formSubmitting}
                    />
                    <button
                      type="button"
                      className="btn-remove-field"
                      onClick={() => removeCustomFieldRow(i)}
                      title="Quitar campo"
                      aria-label="Quitar campo"
                      disabled={formSubmitting}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))
              )}
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
                {formSubmitting ? 'Guardando...' : editingPassenger ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal Vincular */}
        <Modal
          open={bindModalOpen}
          title={`Vincular Pasajero: ${bindTarget?.name || ''}`}
          onClose={() => setBindModalOpen(false)}
        >
          <form onSubmit={handleBindSubmit} className="modal-form">
            <p style={{ color: '#6b6b6b', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Selecciona el vehículo al que deseas asignar este pasajero.
            </p>

            <div className="form-group">
              <label htmlFor="select-unit-passenger">Vehículo asignado</label>
              <select
                id="select-unit-passenger"
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                disabled={bindSubmitting}
              >
                <option value="">-- Sin vehículo (Desasignar) --</option>
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

        {/* ConfirmDialog eliminar */}
        <ConfirmDialog
          open={deleteDialogOpen}
          title="Eliminar pasajero"
          message={`¿Estás seguro de eliminar al pasajero "${deletingPassenger?.name}"?`}
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

