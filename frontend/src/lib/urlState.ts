import type { LatLon, ProfileId } from './types'

const PARAM = {
  start: 's',
  end: 'e',
  hour: 'h',
  area: 'a',
  profiles: 'p',
  factor: 'f',
} as const

export interface UrlState {
  start?: LatLon
  end?: LatLon
  hour?: number
  area?: string
  profiles?: ProfileId[]
  factor?: string
}

function parseLatLon(raw: string | null): LatLon | undefined {
  if (!raw) return undefined
  const [latText, lonText] = raw.split(',')
  const lat = Number.parseFloat(latText)
  const lon = Number.parseFloat(lonText)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined
  return { lat, lon }
}

export function readUrlState(): UrlState {
  const params = new URLSearchParams(window.location.search)
  const hour = Number.parseInt(params.get(PARAM.hour) ?? '', 10)
  const profiles = (params.get(PARAM.profiles) ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean) as ProfileId[]

  return {
    start: parseLatLon(params.get(PARAM.start)),
    end: parseLatLon(params.get(PARAM.end)),
    hour: Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : undefined,
    area: params.get(PARAM.area) ?? undefined,
    profiles: profiles.length ? profiles : undefined,
    factor: params.get(PARAM.factor) ?? undefined,
  }
}

function formatLatLon(point?: LatLon): string | null {
  if (!point) return null
  return `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`
}

/** Replace the address bar entry without adding history noise. */
export function writeUrlState(state: UrlState): void {
  const params = new URLSearchParams()
  const start = formatLatLon(state.start)
  const end = formatLatLon(state.end)

  if (start) params.set(PARAM.start, start)
  if (end) params.set(PARAM.end, end)
  if (state.hour !== undefined) params.set(PARAM.hour, String(state.hour))
  if (state.area) params.set(PARAM.area, state.area)
  if (state.profiles?.length) params.set(PARAM.profiles, state.profiles.join(','))
  if (state.factor) params.set(PARAM.factor, state.factor)

  const query = params.toString()
  const url = `${window.location.pathname}${query ? `?${query}` : ''}`
  window.history.replaceState(null, '', url)
}

export function permalink(state: UrlState): string {
  const params = new URLSearchParams()
  const start = formatLatLon(state.start)
  const end = formatLatLon(state.end)
  if (start) params.set(PARAM.start, start)
  if (end) params.set(PARAM.end, end)
  if (state.hour !== undefined) params.set(PARAM.hour, String(state.hour))
  if (state.area) params.set(PARAM.area, state.area)
  if (state.profiles?.length) params.set(PARAM.profiles, state.profiles.join(','))
  if (state.factor) params.set(PARAM.factor, state.factor)
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`
}
