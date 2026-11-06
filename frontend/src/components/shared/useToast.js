/**
 * useToast.js — Hook para manejar notificaciones toast.
 */

import { useCallback, useRef, useState } from 'react'

/** @typedef {{ id: number, type: 'success'|'error'|'warning'|'info', message: string }} Toast */

export function useToast() {
  const [toasts, setToasts] = useState(/** @type {Toast[]} */ ([]))
  const idRef = useRef(0)

  const push = useCallback((type, message, duration = 4000) => {
    const id = ++idRef.current
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }, [])

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (type, message, duration) => push(type, message, duration),
    [push]
  )

  const success = useCallback((msg, dur) => push('success', msg, dur), [push])
  const error = useCallback((msg, dur) => push('error', msg, dur), [push])
  const warning = useCallback((msg, dur) => push('warning', msg, dur), [push])
  const info = useCallback((msg, dur) => push('info', msg, dur), [push])

  return {
    toasts,
    push,
    toast,
    success,
    error,
    warning,
    info,
    remove,
  }
}
