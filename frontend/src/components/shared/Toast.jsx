/**
 * Toast.jsx — Contenedor de notificaciones tipo toast.
 */

import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import './Toast.css'

const ICONS = {
  success: CheckCircle,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
}

/**
 * @param {{
 *   toasts: Array<{ id: number, type: string, message: string }>,
 *   onRemove: (id: number) => void
 * }} props
 */
export default function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="toast-container" role="region" aria-label="Notificaciones" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.type] ?? Info
        return (
          <div key={toast.id} className={`toast toast-${toast.type}`} role="alert">
            <Icon size={18} aria-hidden="true" />
            <span className="toast-message">{toast.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => onRemove(toast.id)}
              aria-label="Cerrar notificación"
            >
              <X size={15} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
