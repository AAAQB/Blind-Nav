import { useEffect, useRef, useState } from 'react'
import { searchPlaces } from '../lib/api'
import type { Place } from '../lib/types'
import { useDebouncedValue } from './useDebouncedValue'

export interface UsePlacesResult {
  query: string
  setQuery: (value: string) => void
  results: Place[]
  loading: boolean
  error: string | null
  clear: () => void
}

/**
 * Debounced forward geocoding. Requests are aborted when the query changes so
 * late responses cannot clobber the visible suggestions, and a per-query cache
 * avoids re-hitting Nominatim while the user types back and forth.
 */
export function usePlaces(debounceMs = 380): UsePlacesResult {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const debounced = useDebouncedValue(query, debounceMs)
  const cache = useRef(new Map<string, Place[]>())
  const controller = useRef<AbortController | null>(null)

  useEffect(() => {
    const trimmed = debounced.trim()
    if (trimmed.length < 3) {
      controller.current?.abort()
      setResults([])
      setLoading(false)
      setError(null)
      return
    }

    const cached = cache.current.get(trimmed.toLowerCase())
    if (cached) {
      setResults(cached)
      setLoading(false)
      setError(null)
      return
    }

    controller.current?.abort()
    const next = new AbortController()
    controller.current = next
    setLoading(true)
    setError(null)

    searchPlaces(trimmed, next.signal)
      .then((places) => {
        if (next.signal.aborted) return
        cache.current.set(trimmed.toLowerCase(), places)
        setResults(places)
      })
      .catch((err: unknown) => {
        if (next.signal.aborted) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setResults([])
        setError((err as Error).message ?? 'Search failed')
      })
      .finally(() => {
        if (!next.signal.aborted) setLoading(false)
      })
  }, [debounced])

  const clear = () => {
    controller.current?.abort()
    setQuery('')
    setResults([])
    setError(null)
    setLoading(false)
  }

  return { query, setQuery, results, loading, error, clear }
}
