import type { Coord, LatLon, Segment } from './types'

export interface BBox {
  south: number
  north: number
  west: number
  east: number
}

export function boundsOfCoords(coords: Coord[]): BBox | null {
  if (!coords.length) return null
  let south = coords[0][0]
  let north = coords[0][0]
  let west = coords[0][1]
  let east = coords[0][1]
  for (const [lat, lon] of coords) {
    if (lat < south) south = lat
    if (lat > north) north = lat
    if (lon < west) west = lon
    if (lon > east) east = lon
  }
  return { south, north, west, east }
}

/** MapLibre wants [west, south, east, north] as LngLatBoundsLike. */
export function toLngLatBounds(bbox: BBox): [[number, number], [number, number]] {
  return [
    [bbox.west, bbox.south],
    [bbox.east, bbox.north],
  ]
}

export function midpoint(a: LatLon, b: LatLon): LatLon {
  return { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 }
}

/** Great-circle distance in metres. */
export function haversine(a: LatLon | Coord, b: LatLon | Coord): number {
  const [alat, alon] = Array.isArray(a) ? a : [a.lat, a.lon]
  const [blat, blon] = Array.isArray(b) ? b : [b.lat, b.lon]
  const R = 6371000
  const dLat = ((blat - alat) * Math.PI) / 180
  const dLon = ((blon - alon) * Math.PI) / 180
  const lat1 = (alat * Math.PI) / 180
  const lat2 = (blat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/** Bearing in degrees from a to b. */
export function bearing(a: Coord, b: Coord): number {
  const lat1 = (a[0] * Math.PI) / 180
  const lat2 = (b[0] * Math.PI) / 180
  const dLon = ((b[1] - a[1]) * Math.PI) / 180
  const x = Math.sin(dLon) * Math.cos(lat2)
  const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360
}

export function isFiniteLatLon(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    !(Math.abs(lat) < 0.1 && Math.abs(lon) < 0.1)
  )
}

/** Flatten the segments of a route into a single coordinate list. */
export function segmentsToCoords(segments: Segment[]): Coord[] {
  const coords: Coord[] = []
  for (const segment of segments) {
    if (!coords.length) coords.push(segment.from)
    coords.push(segment.to)
  }
  return coords
}

/** Resample a path down to at most `max` points, keeping the endpoints. */
export function simplifyCoords(coords: Coord[], max: number): Coord[] {
  if (coords.length <= max) return coords
  const step = (coords.length - 1) / (max - 1)
  const out: Coord[] = []
  for (let i = 0; i < max; i += 1) out.push(coords[Math.round(i * step)])
  return out
}
