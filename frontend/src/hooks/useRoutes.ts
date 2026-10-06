import { useCallback, useRef, useState } from 'react'
import { planRoutes, type PlanRequest } from '../lib/api'
import { BlindNavError, type RoutesResponse } from '../lib/types'

export type PlanStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface UseRoutesResult {
  status: PlanStatus
  data: RoutesResponse | null
  error: string | null
  errorCode: string | null
  /** True while a newer request supersedes the displayed result. */
  refreshing: boolean
  plan: (request: PlanRequest) => void
  clear: () => void
}

/**
 * Owns the single in-flight planning request. Results are keyed by a monotonic
 * id so a slow response can never overwrite a newer one.
 */
export function useRoutes(): UseRoutesResult {
  const [status, setStatus] = useState<PlanStatus>('idle')
  const [data, setData] = useState<RoutesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [inFlight, setInFlight] = useState(0)

  const controller = useRef<AbortController | null>(null)
  const requestId = useRef(0)

  const clear = useCallback(() => {
    controller.current?.abort()
    controller.current = null
    requestId.current += 1
    setStatus('idle')
    setData(null)
    setError(null)
    setErrorCode(null)
  }, [])

  const plan = useCallback((request: PlanRequest) => {
    controller.current?.abort()
    const next = new AbortController()
    controller.current = next
    requestId.current += 1
    const id = requestId.current

    setError(null)
    setErrorCode(null)
    setStatus('loading')
    setInFlight((count) => count + 1)

    planRoutes(request, next.signal)
      .then((payload) => {
        if (id !== requestId.current) return
        setData(payload)
        setStatus('ready')
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        const blindNavError = err instanceof BlindNavError ? err : null
        setError(blindNavError?.message ?? (err as Error).message ?? 'Route planning failed')
        setErrorCode(blindNavError?.code ?? 'route_error')
        setStatus('error')
      })
      .finally(() => {
        if (id !== requestId.current) return
        setInFlight((count) => Math.max(0, count - 1))
      })
  }, [])

  return {
    status,
    data,
    error,
    errorCode,
    // True when a fresh request is running but a previous result is on screen:
    // the UI then keeps the old routes and shows a subtle progress hint instead
    // of flashing a skeleton over good data.
    refreshing: inFlight > 0 && data !== null,
    plan,
    clear,
  }
}
