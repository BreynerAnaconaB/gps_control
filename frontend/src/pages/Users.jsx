import { useCallback, useEffect, useState } from 'react'
import {
  ShieldCheck,
  Plus,
  KeyRound,
  UserCheck,
  UserX,
  RefreshCw,
} from 'lucide-react'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/shared/PageHeader'
import DataTable from '../components/shared/DataTable'
import Modal from '../components/shared/Modal'
import ConfirmDialog from '../components/shared/ConfirmDialog'
import ToastContainer from '../components/shared/Toast'
import { useToast } from '../components/shared/useToast'
import { getUsers, createUser, updateUser } from '../services/userService'
import './Users.css'

export default function Users() {
  const { toasts, push: toast, remove: removeToast } = useToast()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal crear
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('operator')
  const [createSubmitting, setCreateSubmitting] = useState(false)

  // Modal resetear contraseña
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [targetUser, setTargetUser] = useState(null)
  const [resetPasswordVal, setResetPasswordVal] = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)

  // Dialog toggle estado
  const [toggleDialogOpen, setToggleDialogOpen] = useState(false)
  const [toggleTargetUser, setToggleTargetUser] = useState(null)
  const [toggleSubmitting, setToggleSubmitting] = useState(false)

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getUsers()
      setUsers(data || [])
    } catch (err) {
      toast('error', err.message || 'Error al cargar usuarios')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  async function handleCreateSubmit(e) {
    e.preventDefault()
    const emailVal = newEmail.trim()
    const passVal = newPassword.trim()

    if (!emailVal || !passVal) {
      toast('warning', 'Todos los campos son requeridos')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(emailVal)) {
      toast('warning', 'Ingresa un correo electrónico válido (ej. usuario@dominio.com)')
      return
    }

    if (passVal.length < 8) {
      toast('warning', 'La contraseña temporal debe tener al menos 8 caracteres')
      return
    }

    try {
      setCreateSubmitting(true)
      await createUser(emailVal, passVal, newRole)
      toast('success', 'Usuario creado exitosamente (deberá cambiar contraseña en su primer inicio)')
      setCreateModalOpen(false)
      setNewEmail('')
      setNewPassword('')
      setNewRole('operator')
      loadUsers()
    } catch (err) {
      toast('error', err.message || 'Error al crear usuario')
    } finally {
      setCreateSubmitting(false)
    }
  }

  function openResetModal(u) {
    setTargetUser(u)
    setResetPasswordVal('')
    setResetModalOpen(true)
  }

  async function handleResetSubmit(e) {
    e.preventDefault()
    if (!resetPasswordVal.trim() || resetPasswordVal.length < 8) {
      toast('warning', 'La contraseña debe tener al menos 8 caracteres')
      return
    }

    try {
      setResetSubmitting(true)
      await updateUser(targetUser.id, { new_password: resetPasswordVal.trim() })
      toast('success', 'Contraseña restablecida con éxito')
      setResetModalOpen(false)
      loadUsers()
    } catch (err) {
      toast('error', err.message || 'Error al restablecer contraseña')
    } finally {
      setResetSubmitting(false)
    }
  }

  function openToggleDialog(u) {
    setToggleTargetUser(u)
    setToggleDialogOpen(true)
  }

  async function handleToggleConfirm() {
    if (!toggleTargetUser) return
    try {
      setToggleSubmitting(true)
      const nextActive = !toggleTargetUser.is_active
      await updateUser(toggleTargetUser.id, { is_active: nextActive })
      toast('success', `Usuario ${nextActive ? 'activado' : 'desactivado'}`)
      setToggleDialogOpen(false)
      loadUsers()
    } catch (err) {
      toast('error', err.message || 'Error al actualizar usuario')
    } finally {
      setToggleSubmitting(false)
    }
  }

  async function handleRoleChange(user, nextRole) {
    try {
      await updateUser(user.id, { role: nextRole })
      toast('success', `Rol actualizado a ${nextRole}`)
      loadUsers()
    } catch (err) {
      toast('error', err.message || 'Error al cambiar rol')
    }
  }

  const columns = [
    {
      key: 'email',
      label: 'Correo electrónico',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div className="user-table-avatar">{row.email.slice(0, 2).toUpperCase()}</div>
          <div>
            <strong>{row.email}</strong>
            {row.must_change_password && (
              <small style={{ display: 'block', color: '#ea580c' }}>
                Debe cambiar contraseña
              </small>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Rol en la plataforma',
      render: (row) => (
        <select
          value={row.role}
          onChange={(e) => handleRoleChange(row, e.target.value)}
          className="role-inline-select"
        >
          <option value="admin">Admin</option>
          <option value="operator">Operador</option>
          <option value="viewer">Visualizador</option>
        </select>
      ),
    },
    {
      key: 'is_active',
      label: 'Estado de cuenta',
      render: (row) => (
        <span className={`user-status-pill ${row.is_active ? 'active' : 'inactive'}`}>
          {row.is_active ? 'Activo' : 'Desactivado'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Acciones de administración',
      render: (row) => (
        <div className="action-buttons">
          <button
            type="button"
            className="action-btn"
            onClick={() => openResetModal(row)}
            title="Restablecer credenciales"
            aria-label="Restablecer credenciales"
          >
            <KeyRound size={16} />
          </button>
          <button
            type="button"
            className={`action-btn ${row.is_active ? 'delete' : ''}`}
            onClick={() => openToggleDialog(row)}
            title={row.is_active ? 'Desactivar usuario' : 'Activar usuario'}
            aria-label="Cambiar estado de usuario"
          >
            {row.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
          </button>
        </div>
      ),
    },
  ]

  return (
    <AppLayout
      title="Gestión de Usuarios"
      breadcrumb="GPS Control / Usuarios"
      onRefresh={loadUsers}
      isRefreshing={loading}
    >
      <div className="users-content">
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        <PageHeader
          title="Administración de Usuarios y Roles"
          subtitle="Control de acceso basado en roles (RBAC) y administración de credenciales"
          actions={
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={loadUsers}
                title="Refrescar lista"
              >
                <RefreshCw size={16} /> Refrescar
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setCreateModalOpen(true)}
              >
                <Plus size={16} /> Nuevo Usuario
              </button>
            </div>
          }
        />

        <div className="users-content">
          <DataTable
            columns={columns}
            data={users}
            loading={loading}
            emptyMessage="No hay usuarios registrados en el sistema."
            emptyIcon={<ShieldCheck size={36} />}
            rowKey={(r) => r.id}
          />
        </div>

        {/* Modal Crear Usuario */}
        <Modal
          open={createModalOpen}
          title="Crear Nuevo Usuario"
          onClose={() => setCreateModalOpen(false)}
        >
          <form onSubmit={handleCreateSubmit} className="modal-form">
            <div className="form-group">
              <label htmlFor="user-email">Correo electrónico *</label>
              <input
                id="user-email"
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="operador@gpscontrol.co"
                disabled={createSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="user-pass">Contraseña temporal * (mín. 8 caracteres)</label>
              <input
                id="user-pass"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                disabled={createSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="user-role">Rol asignado *</label>
              <select
                id="user-role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                disabled={createSubmitting}
              >
                <option value="operator">Operador (Edición y Monitoreo)</option>
                <option value="viewer">Visualizador (Solo Lectura)</option>
                <option value="admin">Administrador (Total)</option>
              </select>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setCreateModalOpen(false)}
                disabled={createSubmitting}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={createSubmitting}>
                {createSubmitting ? 'Creando...' : 'Crear usuario'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal Restablecer Contraseña */}
        <Modal
          open={resetModalOpen}
          title={`Restablecer Contraseña: ${targetUser?.email || ''}`}
          onClose={() => setResetModalOpen(false)}
        >
          <form onSubmit={handleResetSubmit} className="modal-form">
            <p style={{ color: '#6b6b6b', fontSize: '0.85rem' }}>
              El usuario deberá cambiar esta contraseña la próxima vez que inicie sesión.
            </p>

            <div className="form-group">
              <label htmlFor="reset-pass">Nueva contraseña temporal *</label>
              <input
                id="reset-pass"
                type="password"
                required
                minLength={8}
                value={resetPasswordVal}
                onChange={(e) => setResetPasswordVal(e.target.value)}
                placeholder="••••••••"
                disabled={resetSubmitting}
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setResetModalOpen(false)}
                disabled={resetSubmitting}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={resetSubmitting}>
                {resetSubmitting ? 'Guardando...' : 'Restablecer'}
              </button>
            </div>
          </form>
        </Modal>

        {/* ConfirmDialog Activar / Desactivar */}
        <ConfirmDialog
          open={toggleDialogOpen}
          title={toggleTargetUser?.is_active ? 'Desactivar usuario' : 'Activar usuario'}
          message={`¿Estás seguro de que deseas ${
            toggleTargetUser?.is_active ? 'desactivar' : 'activar'
          } la cuenta de "${toggleTargetUser?.email}"?`}
          confirmLabel={toggleTargetUser?.is_active ? 'Desactivar' : 'Activar'}
          danger={toggleTargetUser?.is_active}
          loading={toggleSubmitting}
          onConfirm={handleToggleConfirm}
          onCancel={() => setToggleDialogOpen(false)}
        />
      </div>
    </AppLayout>
  )
}

