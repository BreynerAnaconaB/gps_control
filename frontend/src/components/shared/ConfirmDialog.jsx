/**
 * ConfirmDialog.jsx — Modal de confirmación para acciones destructivas.
 */

import Modal from './Modal'
import './ConfirmDialog.css'

/**
 * @param {{
 *   open: boolean,
 *   title?: string,
 *   message: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   danger?: boolean,
 *   loading?: boolean,
 *   onConfirm: () => void,
 *   onCancel: () => void,
 * }} props
 */
export default function ConfirmDialog({
  open,
  title = '¿Confirmar acción?',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal open={open} title={title} onClose={onCancel} size="sm">
      <p className="confirm-message">{message}</p>
      <div className="confirm-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onCancel}
          disabled={loading}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? 'Procesando…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
