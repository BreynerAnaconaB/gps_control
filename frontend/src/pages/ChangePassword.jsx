import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, ShieldAlert } from 'lucide-react'
import { changePassword } from '../services/authService'
import './ChangePassword.css'

export default function ChangePassword() {
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    try {
      setLoading(true)
      await changePassword(currentPassword, newPassword)
      navigate('/app', { replace: true })
    } catch (err) {
      setError(err.message || 'Error al cambiar la contraseña.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="change-pass-page">
      <div className="change-pass-card">
        <div className="change-pass-header">
          <div className="change-pass-icon">
            <KeyRound size={28} />
          </div>
          <h1>Actualización de Contraseña</h1>
          <p>
            Por seguridad de tu organización, debes cambiar la contraseña temporal asignada
            antes de ingresar a la plataforma.
          </p>
        </div>

        {error && (
          <div className="change-pass-error" role="alert">
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="change-pass-form">
          <div className="form-group">
            <label htmlFor="current-p">Contraseña temporal actual *</label>
            <input
              id="current-p"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="new-p">Nueva contraseña segura *</label>
            <input
              id="new-p"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirm-p">Confirmar nueva contraseña *</label>
            <input
              id="confirm-p"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn-primary btn-large" disabled={loading}>
            {loading ? 'Actualizando...' : 'Guardar y entrar al panel'}
          </button>
        </form>
      </div>
    </div>
  )
}

