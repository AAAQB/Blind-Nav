import type { Coord } from './types'

/** Human distance: metres below 1 km, one decimal above. */
export function formatDistance(metres: number): string {
  if (!Number.isFinite(metres)) return '—'
  if (metres < 10) return `${metres.toFixed(1)} m`
  if (metres < 1000) return `${Math.round(metres)} m`
  return `${(metres / 1000).toFixed(2)} km`
}

/** Compact distance for dense chips. */
export function formatDistanceShort(metres: number): string {
  if (!Number.isFinite(metres)) return '—'
  if (metres < 1000) return `${Math.round(metres)}m`
  return `${(metres / 1000).toFixed(1)}km`
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  const minutes = Math.round(seconds / 60)
  if (minutes < 1) return '<1 min'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

export function formatPercent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`
}

export function formatCoord(value: number, digits = 5): string {
  return value.toFixed(digits)
}

export function formatCoordPair(coord: Coord): string {
  return `${formatCoord(coord[0])}, ${formatCoord(coord[1])}`
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

export function formatInteger(value: number): string {
  return value.toLocaleString('en-US')
}
