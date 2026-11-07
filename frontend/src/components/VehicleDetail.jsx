import { useEffect, useState } from 'react'
import {
  X,
  Truck,
  Activity,
  Battery,
  Radio,
  Settings2,
  LoaderCircle,
  UserCheck,
  UserX,
  Users,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'

import {
  getVehicleDetail,
  updateVehicleCustomFields,
  deleteVehicleCustomField,
} from '../services/vehicleService'
import { useAuth } from '../context/AuthContext'
import ConfirmDialog from './shared/ConfirmDialog'
import { useToast } from './shared/useToast'
import Toast from './shared/Toast'

const sensorIcons = {
  'engine operation': Activity,
  voltage: Battery,
  'alarm trigger': Radio,
}

export default function VehicleDetail({ vehicle, onClose }) {
  const { user } = useAuth()
  const canEdit = user?.role === 'Admin' || user?.role === 'Operador'
  const { toasts, push: toast, remove: removeToast } = useToast()

  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Custom field editing states
  const [editingFieldId, setEditingFieldId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [isSavingField, setIsSavingField] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldValue, setNewFieldValue] = useState('')
  const [fieldToDelete, setFieldToDelete] = useState(null)

  useEffect(() => {
    let active = true

    async function loadDetail() {
      try {
        setLoading(true)
        setError(null)
        setDetail(null)

        const data = await getVehicleDetail(vehicle.id)
        if (active) setDetail(data)
      } catch (err) {
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadDetail()

    return () => {
      active = false
    }
  }, [vehicle.id])

  // Custom fields list: use custom_field_items if available, fallback to custom_fields dict
  const customFieldsList = detail?.custom_field_items?.length
    ? detail.custom_field_items
    : Object.entries(detail?.custom_fields || {}).map(([name, value], idx) => ({
        id: idx + 1,
        name,
        value,
      }))

  // -------------------------------------------------------------------------
  // Handlers for Custom Fields (RF-19, RF-20, RF-21 with Optimistic Update)
  // -------------------------------------------------------------------------

  const handleStartEdit = (field) => {
    setEditingFieldId(field.id)
    setEditValue(field.value || '')
  }

  const handleCancelEdit = () => {
    setEditingFieldId(null)
    setEditValue('')
  }

  const handleSaveEdit = async (field) => {
    if (editValue.trim() === field.value) {
      handleCancelEdit()
      return
    }

    const previousDetail = { ...detail }
    // Optimistic update
    const updatedItems = (detail.custom_field_items || []).map((f) =>
      f.id === field.id ? { ...f, value: editValue.trim() } : f
    )
    setDetail({
      ...detail,
      custom_field_items: updatedItems,
      custom_fields: {
        ...(detail.custom_fields || {}),
        [field.name]: editValue.trim(),
      },
    })
    setIsSavingField(true)

    try {
      await updateVehicleCustomFields(vehicle.id, [
        {
          field_id: field.id,
          name: field.name,
          value: editValue.trim(),
        },
      ])
      toast('success', `Campo "${field.name}" actualizado en Wialon`)
      handleCancelEdit()
    } catch (err) {
      // Rollback on failure
      setDetail(previousDetail)
      toast('error', `Error al actualizar campo: ${err.message}`)
    } finally {
      setIsSavingField(false)
    }
  }

  const handleAddField = async (e) => {
    e.preventDefault()
    if (!newFieldName.trim()) return

    const previousDetail = { ...detail }
    setIsSavingField(true)

    try {
      const res = await updateVehicleCustomFields(vehicle.id, [
        {
          name: newFieldName.trim(),
          value: newFieldValue.trim(),
        },
      ])

      const addedField = Array.isArray(res) && res[0] ? res[0] : null
      const newItems = [
        ...(detail.custom_field_items || []),
        {
          id: addedField?.field_id || Date.now(),
          name: newFieldName.trim(),
          value: newFieldValue.trim(),
        },
      ]

      setDetail({
        ...detail,
        custom_field_items: newItems,
        custom_fields: {
          ...(detail.custom_fields || {}),
          [newFieldName.trim()]: newFieldValue.trim(),
        },
      })

      toast('success', `Campo "${newFieldName.trim()}" creado exitosamente`)
      setShowAddModal(false)
      setNewFieldName('')
      setNewFieldValue('')
    } catch (err) {
      setDetail(previousDetail)
      toast('error', `Error al crear campo: ${err.message}`)
    } finally {
      setIsSavingField(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!fieldToDelete) return

    const previousDetail = { ...detail }
    const fieldId = fieldToDelete.id
    const fieldName = fieldToDelete.name

    // Optimistic removal
    setDetail({
      ...detail,
      custom_field_items: (detail.custom_field_items || []).filter(
        (f) => f.id !== fieldId
      ),
    })
    setFieldToDelete(null)

    try {
      await deleteVehicleCustomField(vehicle.id, fieldId)
      toast('success', `Campo "${fieldName}" eliminado de Wialon`)
    } catch (err) {
      setDetail(previousDetail)
      toast('error', `Error al eliminar campo: ${err.message}`)
    }
  }

  return (
    <aside className="vehicle-detail">
      <Toast toasts={toasts} onRemove={removeToast} />

      <div className="detail-header">
        <div>
          <span className="detail-eyebrow">DETALLE DEL VEHÍCULO</span>
          <h3>{vehicle.name}</h3>
        </div>

        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Cerrar detalle"
        >
          <X size={19} />
        </button>
      </div>

      {loading ? (
        <div className="detail-state">
          <LoaderCircle className="spin" size={25} />
          <span>Consultando información...</span>
        </div>
      ) : error ? (
        <div className="detail-error">
          <AlertCircle size={24} color="#eb162c" />
          <p>{error}</p>
          <button
            type="button"
            className="btn-retry"
            onClick={() => {
              setDetail(null)
              setLoading(true)
              getVehicleDetail(vehicle.id)
                .then(setDetail)
                .catch((err) => setError(err.message))
                .finally(() => setLoading(false))
            }}
          >
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      ) : (
        <>
          {/* Tarjeta de estado del vehículo */}
          <div className="detail-vehicle-card">
            <div className="detail-vehicle-icon">
              <Truck size={28} />
            </div>

            <div>
              <strong>{detail?.name || vehicle.name}</strong>
              <span>
                {detail?.active ? 'Dispositivo activo' : 'Dispositivo inactivo'}
              </span>
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* RF-12 / RF-13: Conductor Asignado en Wialon                      */}
          {/* ---------------------------------------------------------------- */}
          <section className="detail-section">
            <div className="detail-section-title">
              <UserCheck size={17} />
              <h4>Conductor Asignado</h4>
            </div>

            {detail?.assigned_driver ? (
              <div className="detail-driver-card assigned">
                <div className="driver-avatar-icon">
                  <UserCheck size={20} />
                </div>
                <div className="driver-details">
                  <strong>{detail.assigned_driver.name}</strong>
                  {detail.assigned_driver.code && (
                    <span className="driver-code">
                      Código: {detail.assigned_driver.code}
                    </span>
                  )}
                  {detail.assigned_driver.phone && (
                    <span className="driver-phone">
                      Tel: {detail.assigned_driver.phone}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="detail-driver-card unassigned">
                <UserX size={18} />
                <span>Sin conductor vinculado actualmente</span>
              </div>
            )}
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* RF-09: Pasajeros asignados a la unidad                           */}
          {/* ---------------------------------------------------------------- */}
          <section className="detail-section">
            <div className="detail-section-title">
              <Users size={17} />
              <h4>
                Pasajeros Asignados (
                {detail?.assigned_passengers?.length || 0})
              </h4>
            </div>

            {detail?.assigned_passengers?.length > 0 ? (
              <div className="passenger-tags-list">
                {detail.assigned_passengers.map((p) => (
                  <div key={p.id} className="passenger-tag-pill">
                    <span className="passenger-tag-name">{p.name}</span>
                    {p.code && (
                      <span className="passenger-tag-code">({p.code})</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="detail-muted">
                No hay pasajeros asignados a este vehículo.
              </p>
            )}
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* RF-19, RF-20, RF-21: Campos personalizados CRUD interactivo       */}
          {/* ---------------------------------------------------------------- */}
          <section className="detail-section">
            <div className="detail-section-header">
              <div className="detail-section-title">
                <Settings2 size={17} />
                <h4>Campos Personalizados ({customFieldsList.length})</h4>
              </div>

              {canEdit && (
                <button
                  type="button"
                  className="btn-add-field"
                  onClick={() => setShowAddModal(true)}
                  title="Agregar nuevo campo personalizado"
                >
                  <Plus size={14} /> Campo
                </button>
              )}
            </div>

            <div className="detail-custom-fields-list">
              {customFieldsList.length > 0 ? (
                customFieldsList.map((field) => (
                  <div className="custom-field-row" key={field.id || field.name}>
                    <div className="field-info">
                      <span className="field-name">{field.name}</span>
                      {editingFieldId === field.id ? (
                        <div className="field-edit-inline">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            disabled={isSavingField}
                            autoFocus
                          />
                          <button
                            type="button"
                            className="btn-save-inline"
                            onClick={() => handleSaveEdit(field)}
                            disabled={isSavingField}
                            title="Guardar"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn-cancel-inline"
                            onClick={handleCancelEdit}
                            disabled={isSavingField}
                            title="Cancelar"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <strong className="field-val">
                          {field.value || '—'}
                        </strong>
                      )}
                    </div>

                    {canEdit && editingFieldId !== field.id && (
                      <div className="field-actions">
                        <button
                          type="button"
                          className="field-action-btn"
                          onClick={() => handleStartEdit(field)}
                          title="Editar valor"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          className="field-action-btn delete"
                          onClick={() => setFieldToDelete(field)}
                          title="Eliminar campo"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="detail-muted">
                  No hay campos personalizados disponibles.
                </p>
              )}
            </div>
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* Sensores                                                         */}
          {/* ---------------------------------------------------------------- */}
          <section className="detail-section">
            <div className="detail-section-title">
              <Activity size={17} />
              <h4>Sensores ({detail?.sensors?.length || 0})</h4>
            </div>

            <div className="sensor-list">
              {detail?.sensors?.length ? (
                detail.sensors.map((sensor, index) => {
                  const Icon = sensorIcons[sensor.type] || Radio

                  return (
                    <div className="sensor-item" key={sensor.id ?? index}>
                      <div className="sensor-icon">
                        <Icon size={17} />
                      </div>

                      <div>
                        <strong>{sensor.name}</strong>
                        <span>{sensor.type || 'Sensor'}</span>
                      </div>

                      <small>{sensor.unit || '—'}</small>
                    </div>
                  )
                })
              ) : (
                <p className="detail-muted">
                  No hay sensores registrados.
                </p>
              )}
            </div>
          </section>
        </>
      )}

      {/* Modal para agregar nuevo campo personalizado */}
      {showAddModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box">
            <h3>Nuevo Campo Personalizado</h3>
            <p>Agrega un campo personalizado a la unidad en Wialon.</p>
            <form onSubmit={handleAddField}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Nombre del campo (ej. COLOR, PLACA, SEGURO)</label>
                <input
                  type="text"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  placeholder="NOMBRE_CAMPO"
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Valor</label>
                <input
                  type="text"
                  value={newFieldValue}
                  onChange={(e) => setNewFieldValue(e.target.value)}
                  placeholder="Valor del campo"
                  required
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  disabled={isSavingField}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSavingField}
                >
                  {isSavingField ? 'Guardando en Wialon...' : 'Crear Campo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmación de eliminación */}
      <ConfirmDialog
        open={Boolean(fieldToDelete)}
        title="Eliminar campo personalizado"
        message={`¿Estás seguro de eliminar el campo "${fieldToDelete?.name}" de este vehículo en Wialon?`}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setFieldToDelete(null)}
      />
    </aside>
  )
}
