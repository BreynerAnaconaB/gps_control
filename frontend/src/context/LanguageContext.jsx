import { createContext, useContext, useState, useEffect } from 'react'

const translations = {
  es: {
    dashboard: 'Panel de control',
    monitoring: 'Monitoreo',
    drivers: 'Conductores',
    passengers: 'Pasajeros',
    history: 'Historial',
    users: 'Usuarios',
    audit: 'Auditoría',
    moving: 'En movimiento',
    stopped: 'Detenido',
    noSignal: 'Sin señal',
    logout: 'Cerrar sesión',
    totalVehicles: 'Total vehículos',
    withDriver: 'Con conductor',
    withoutDriver: 'Sin conductor',
    wialonOnline: 'Wialon Online',
    refresh: 'Actualizar',
    language: 'Idioma',
  },
  en: {
    dashboard: 'Dashboard',
    monitoring: 'Monitoring',
    drivers: 'Drivers',
    passengers: 'Passengers',
    history: 'Trip History',
    users: 'Users',
    audit: 'Audit Log',
    moving: 'Moving',
    stopped: 'Stopped',
    noSignal: 'No signal',
    logout: 'Log out',
    totalVehicles: 'Total vehicles',
    withDriver: 'With driver',
    withoutDriver: 'Without driver',
    wialonOnline: 'Wialon Online',
    refresh: 'Refresh',
    language: 'Language',
  },
}

const LanguageContext = createContext({
  language: 'es',
  setLanguage: () => {},
  t: (key) => key,
})

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('gps_lang') || 'es'
  })

  useEffect(() => {
    localStorage.setItem('gps_lang', language)
    document.documentElement.lang = language === 'es' ? 'es-CO' : 'en-US'
  }, [language])

  const t = (key) => {
    return translations[language]?.[key] || translations.es[key] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}

