
import { Link } from 'react-router-dom'
import {
  Map,
  Truck,
  Users,
  BarChart2,
  Shield,
  Zap,
  ArrowRight,
  Radio,
  CheckCircle2,
  Globe,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './Landing.css'

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const features = [
  {
    icon: Map,
    title: 'Monitoreo en tiempo real',
    description:
      'Visualiza la posición exacta de cada vehículo en el mapa, actualizada automáticamente cada 30 segundos.',
  },
  {
    icon: Truck,
    title: 'Gestión de flota',
    description:
      'Administra vehículos, consulta sus campos personalizados y mantén toda la información organizada en un solo lugar.',
  },
  {
    icon: Users,
    title: 'Conductores y pasajeros',
    description:
      'Crea, edita y vincula conductores y pasajeros a sus vehículos. Los cambios se sincronizan con Wialon en tiempo real.',
  },
  {
    icon: BarChart2,
    title: 'Dashboard con KPIs',
    description:
      'Métricas clave de tu flota: vehículos en movimiento, detenidos, sin señal, y distribución de conductores.',
  },
  {
    icon: Shield,
    title: 'Control de acceso por roles',
    description:
      'Admin, Operador y Visualizador. Cada rol ve y hace exactamente lo que le corresponde, sin excepciones.',
  },
  {
    icon: Zap,
    title: 'Historial de recorridos',
    description:
      'Revisa y reproduce los recorridos de cualquier vehículo en un rango de fechas, con datos de velocidad.',
  },
]

const steps = [
  {
    number: '01',
    title: 'Inicia sesión',
    description: 'Accede con tu correo y contraseña. Tu sesión es segura y está cifrada de extremo a extremo.',
  },
  {
    number: '02',
    title: 'Visualiza tu flota',
    description: 'Consulta el mapa con todos tus vehículos en vivo y filtra por estado en segundos.',
  },
  {
    number: '03',
    title: 'Gestiona y exporta',
    description: 'Administra conductores, pasajeros, campos personalizados y exporta reportes en CSV.',
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Landing() {
  const { user } = useAuth()

  return (
    <div className="landing">
      {/* ------------------------------------------------------------------ */}
      {/* Nav                                                                  */}
      {/* ------------------------------------------------------------------ */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-brand">
            <div className="landing-brand-icon">
              <Radio size={22} />
            </div>
            <span>GPS Control</span>
          </div>

          <nav className="landing-nav-links" aria-label="Navegación principal">
            <a href="#features">Funcionalidades</a>
            <a href="#how">Cómo funciona</a>
          </nav>

          {user ? (
            <Link to="/app" className="btn-primary">
              Ir al panel <ArrowRight size={16} />
            </Link>
          ) : (
            <Link to="/login" className="btn-primary">
              Iniciar sesión <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="landing-hero" aria-labelledby="hero-heading">
        <div className="landing-hero-content">
          <div className="landing-hero-badge">
            <span className="live-dot" aria-hidden="true" />
            Integración nativa con Wialon API · Monitoreo de flotas
          </div>

          <h1 id="hero-heading">
            Monitoreo de flota
            <br />
            <span className="hero-accent">profesional y seguro</span>
          </h1>

          <p>
            Gestiona, rastrea y analiza tu flota vehicular desde una sola
            plataforma. Datos en tiempo real, control de acceso por roles y
            sincronización directa con Wialon.
          </p>

          <div className="hero-cta">
            {user ? (
              <Link to="/app" className="btn-primary btn-large">
                Ir al panel de control <ArrowRight size={18} />
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn-primary btn-large">
                  Comenzar ahora <ArrowRight size={18} />
                </Link>
                <a href="#features" className="btn-ghost btn-large">
                  Ver funcionalidades
                </a>
              </>
            )}
          </div>

          <ul className="hero-bullets" aria-label="Características destacadas">
            {[
              'Mapa interactivo con telemetría en vivo',
              'Control de acceso RBAC con 3 roles',
              'Auditoría y exportación a CSV',
            ].map((text) => (
              <li key={text}>
                <CheckCircle2 size={16} aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="landing-hero-visual" aria-hidden="true">
          <div className="hero-map-mockup">
            <div className="mock-topbar">
              <span className="mock-dot red" />
              <span className="mock-dot yellow" />
              <span className="mock-dot green" />
              <span className="mock-title">GPS Control · Panel de control</span>
            </div>
            <div className="mock-body">
              <div className="mock-sidebar">
                {['Monitoreo', 'Conductores', 'Pasajeros', 'Historial'].map((item) => (
                  <div key={item} className="mock-menu-item">{item}</div>
                ))}
              </div>
              <div className="mock-main">
                <div className="mock-stats">
                  {['Monitoreo en vivo', 'Telemetría GPS', 'Control de rutas', 'Sensores activos'].map((s) => (
                    <div key={s} className="mock-stat">{s}</div>
                  ))}
                </div>
                <div className="mock-map">
                  <Globe size={48} strokeWidth={1} />
                  <span>Vista interactiva de flota</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Value proposition                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="landing-value">
        <div className="landing-container">
          <p className="value-text">
            Construido sobre <strong>Wialon</strong>, la plataforma de rastreo GPS
            más usada en Latinoamérica, con una interfaz moderna y un backend
            seguro que nunca expone tus credenciales al navegador.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Features                                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="landing-features" id="features" aria-labelledby="features-heading">
        <div className="landing-container">
          <div className="section-label">Funcionalidades</div>
          <h2 id="features-heading">Todo lo que necesitas para gestionar tu flota</h2>
          <p className="section-subtitle">
            Una plataforma completa, desde el mapa hasta la gestión de usuarios,
            pensada para operadores que necesitan información confiable.
          </p>

          <div className="features-grid">
            {features.map(({ icon: Icon, title, description }) => (
              <article className="feature-card" key={title}>
                <div className="feature-icon" aria-hidden="true">
                  <Icon size={24} />
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* How it works                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="landing-how" id="how" aria-labelledby="how-heading">
        <div className="landing-container">
          <div className="section-label">Cómo funciona</div>
          <h2 id="how-heading">En tres pasos estás monitoreando</h2>

          <div className="steps-grid">
            {steps.map(({ number, title, description }) => (
              <div className="step-card" key={number}>
                <div className="step-number" aria-hidden="true">{number}</div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* CTA                                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section className="landing-cta" aria-labelledby="cta-heading">
        <div className="landing-container landing-cta-inner">
          <h2 id="cta-heading">¿Listo para ver tu flota en tiempo real?</h2>
          <p>Inicia sesión y empieza a monitorear en menos de un minuto.</p>

          {user ? (
            <Link to="/app" className="btn-primary btn-large">
              Ir al panel de control <ArrowRight size={18} />
            </Link>
          ) : (
            <Link to="/login" className="btn-primary btn-large">
              Iniciar sesión <ArrowRight size={18} />
            </Link>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Footer                                                               */}
      {/* ------------------------------------------------------------------ */}
      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <div className="landing-brand">
            <div className="landing-brand-icon">
              <Radio size={18} />
            </div>
            <span>GPS Control</span>
          </div>

          <p>© {new Date().getFullYear()} GPS Control. Plataforma de monitoreo de flotas.</p>

          <nav aria-label="Navegación del pie de página">
            <Link to="/login">Iniciar sesión</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}

