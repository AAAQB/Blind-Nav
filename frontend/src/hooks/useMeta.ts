import { useEffect, useState } from 'react'
import { fetchMeta } from '../lib/api'
import type { Meta } from '../lib/types'

let cached: Meta | null = null

/** Load /api/v2/meta once per session; every later mount reuses the result. */
export function useMeta() {
  const [meta, setMeta] = useState<Meta | null>(cached)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cached) return
    let active = true
    fetchMeta()
      .then((payload) => {
        cached = payload
        if (active) setMeta(payload)
      })
      .catch((err: Error) => {
        if (active) setError(err.message)
      })
    return () => {
      active = false
    }
  }, [])

  return { meta, error }
}
