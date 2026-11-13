import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

type Status = 'checking' | 'waking' | 'online' | 'offline'

// Render's free tier sleeps after inactivity and the first request can take ~50 s
const WAKING_AFTER_MS = 2_000
const GIVE_UP_AFTER_MS = 90_000
const RETRY_EVERY_MS = 5_000

export function ServerStatus() {
  const [status, setStatus] = useState<Status>('checking')

  useEffect(() => {
    let cancelled = false
    const startedAt = Date.now()
    const wakingTimer = setTimeout(() => !cancelled && setStatus('waking'), WAKING_AFTER_MS)
    let retryTimer: ReturnType<typeof setTimeout>

    const check = async () => {
      try {
        await apiFetch('/health')
        if (!cancelled) setStatus('online')
        clearTimeout(wakingTimer)
      } catch {
        if (cancelled) return
        if (Date.now() - startedAt > GIVE_UP_AFTER_MS) {
          clearTimeout(wakingTimer)
          setStatus('offline')
        } else {
          retryTimer = setTimeout(check, RETRY_EVERY_MS)
        }
      }
    }
    void check()

    return () => {
      cancelled = true
      clearTimeout(wakingTimer)
      clearTimeout(retryTimer)
    }
  }, [])

  if (status === 'online' || status === 'checking') return null

  return status === 'waking' ? (
    <div className="bg-amber-100 px-4 py-2 text-sm text-amber-900">
      Conectando con el servidor... puede tardar hasta un minuto si estuvo inactivo.
    </div>
  ) : (
    <div className="bg-red-100 px-4 py-2 text-sm text-red-900">
      No se pudo conectar con el servidor. Revisá la conexión a internet y recargá la página.
    </div>
  )
}
