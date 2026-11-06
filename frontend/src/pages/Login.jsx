
import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Radio, Eye, EyeOff, AlertCircle, LoaderCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './Login.css'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  // Redirect destination after login (preserved by ProtectedRoute)
  const from = location.state?.from?.pathname ?? '/app'

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await login(email.trim(), password)

      if (result.must_change_password) {
        navigate('/app/change-password', { replace: true })
      } else {
        navigate(from, { replace: true })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Left panel */}
      <aside className="login-aside" aria-hidden="true">
        <div className="login-aside-content">
          <div className="login-brand">
            <div className="login-brand-icon">
              <Radio size={24} />
            </div>
            <span>GPS Control</span>
          </div>

          <blockquote className="login-quote">
            "Monitoreo inteligente, flota bajo control."
          </blockquote>

          <div className="login-aside-visual">
            {['24 vehículos activos', '18 en movimiento', 'Cobertura nacional'].map((text) => (
              <div key={text} className="login-stat-pill">{text}</div>
            ))}
          </div>
        </div>
      </aside>

      {/* Form panel */}
      <main className="login-main">
        <div className="login-form-wrapper">
          <div className="login-header">
            <Link to="/" className="login-back" aria-label="Volver a la página de inicio">
              ← Volver al inicio
            </Link>

            <h1>Bienvenido de nuevo</h1>
            <p>Ingresa tus credenciales para acceder al panel de control.</p>
          </div>

          <form
            className="login-form"
            onSubmit={handleSubmit}
            noValidate
            aria-label="Formulario de inicio de sesión"
          >
            {error && (
              <div className="login-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Correo electrónico</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                required
                autoComplete="email"
                autoFocus
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <div className="password-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="login-submit"
              disabled={loading || !email || !password}
            >
              {loading ? (
                <>
                  <LoaderCircle size={18} className="spin" aria-hidden="true" />
                  Verificando...
                </>
              ) : (
                'Iniciar sesión'
              )}
            </button>
          </form>

          <p className="login-footer-note">
            ¿Problemas para ingresar? Contacta al administrador de tu organización.
          </p>
        </div>
      </main>
    </div>
  )
}

