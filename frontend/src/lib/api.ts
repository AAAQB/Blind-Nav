import { BlindNavError, type LatLon, type Meta, type Place, type ProfileId, type RoutesResponse } from './types'

const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, init)
  } catch {
    throw new BlindNavError('Cannot reach the BlindNav service. Is the backend running?', 'offline')
  }

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const body = payload as { message?: string; error?: string; code?: string } | null
    const message = body?.message || body?.error || `Request failed (HTTP ${response.status})`
    throw new BlindNavError(message, body?.code || `http_${response.status}`)
  }

  return payload as T
}

export function fetchMeta(): Promise<Meta> {
  return request<Meta>('/v2/meta')
}

export interface PlanRequest {
  start: LatLon
  end: LatLon
  hour: number
  area: string
  profiles: ProfileId[]
  useDynamicCost: boolean
}

export function planRoutes(body: PlanRequest, signal?: AbortSignal): Promise<RoutesResponse> {
  return request<RoutesResponse>('/v2/routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      start: body.start,
      end: body.end,
      hour: body.hour,
      area: body.area,
      profiles: body.profiles,
      use_dynamic_cost: body.useDynamicCost,
    }),
  })
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const trimmed = query.trim()
  if (trimmed.length < 3) return []
  const payload = await request<{ results: Place[] }>(
    `/v2/search?q=${encodeURIComponent(trimmed)}`,
    { signal },
  )
  return payload.results ?? []
}

export interface ReverseResult {
  label: string
  name: string
  road: string | null
  suburb: string | null
  city: string | null
  country: string | null
  lat: number
  lon: number
}

export async function reverseGeocode(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<ReverseResult> {
  const payload = await request<{ place: ReverseResult }>(
    `/v2/reverse?lat=${lat}&lon=${lon}`,
    { signal },
  )
  return payload.place
}
