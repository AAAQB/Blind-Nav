import { useEffect, useRef } from 'react'
import type { GeoJSONSource, Map as MapLibreMap, MapGeoJSONFeature } from 'maplibre-gl'
import type { Coord, ProfileId, RoutePlan, Segment } from '../../lib/types'
import { segmentColor } from '../../lib/risk'
import { styleReady } from './useMapLibre'

export const BAND_PREFIX = 'bn-band-'
export const CORE_PREFIX = 'bn-core-'
export const GLOW_PREFIX = 'bn-glow-'
export const FLOW_LAYER = 'bn-flow'
export const HIGHLIGHT_LAYER = 'bn-highlight'
const FLOW_SOURCE = 'bn-flow-src'
const HIGHLIGHT_SOURCE = 'bn-highlight-src'

const REVEAL_MS = 760
const FLOW_INTERVAL_MS = 70

/** Marching-ants dash sequences (values are multiples of the line width). */
const DASH_SEQUENCE: number[][] = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0],
  [0, 0.5, 3, 3.5],
  [0, 1, 3, 3],
  [0, 1.5, 3, 2.5],
  [0, 2, 3, 2],
  [0, 2.5, 3, 1.5],
  [0, 3, 3, 1],
  [0, 3.5, 3, 0.5],
]

type Feature = {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: { type: 'LineString'; coordinates: number[][] }
}

const EMPTY: { type: 'FeatureCollection'; features: Feature[] } = {
  type: 'FeatureCollection',
  features: [],
}

function lineFeature(coords: Coord[], properties: Record<string, unknown> = {}): Feature {
  return {
    type: 'Feature',
    properties,
    geometry: {
      type: 'LineString',
      coordinates: coords.map(([lat, lon]) => [lon, lat]),
    },
  }
}

function collection(features: Feature[]) {
  return { type: 'FeatureCollection' as const, features }
}

function segmentProperties(routeId: string, segment: Segment, color: string) {
  return {
    route: routeId,
    index: segment.index,
    color,
    highway: segment.highway,
    name: segment.name ?? '',
    tactile: segment.tactile_paving,
    lit: segment.lit,
    sidewalk: segment.sidewalk,
    surface: segment.surface,
    incline: segment.incline_pct,
    width: segment.width_m ?? -1,
    steps: segment.steps ? 1 : 0,
    risk: segment.risk,
    length: segment.length_m,
    duration: segment.duration_s,
    reasons: segment.risk_reasons.map((reason) => reason.label).join(', '),
  }
}

/** Every source/layer id this overlay owns, so a style swap can drop them. */
const OWNED_PREFIXES = [BAND_PREFIX, CORE_PREFIX, GLOW_PREFIX]
const OWNED_EXACT = [FLOW_SOURCE, FLOW_LAYER, HIGHLIGHT_SOURCE, HIGHLIGHT_LAYER]

function teardown(map: MapLibreMap) {
  const style = map.getStyle()
  if (!style) return

  for (const layer of style.layers ?? []) {
    const owned = OWNED_PREFIXES.some((prefix) => layer.id.startsWith(prefix)) || OWNED_EXACT.includes(layer.id)
    if (owned && map.getLayer(layer.id)) map.removeLayer(layer.id)
  }
  for (const sourceId of Object.keys(style.sources ?? {})) {
    const owned = OWNED_PREFIXES.some((prefix) => sourceId.startsWith(prefix)) || OWNED_EXACT.includes(sourceId)
    if (owned && map.getSource(sourceId)) map.removeSource(sourceId)
  }
}

/** Slice a path to the first `fraction` of its geometric length. */
export function sliceCoords(coords: Coord[], fraction: number): Coord[] {
  if (fraction >= 1 || coords.length < 2) return coords

  const lengths: number[] = []
  let total = 0
  for (let i = 1; i < coords.length; i += 1) {
    const d = Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1])
    lengths.push(d)
    total += d
  }

  const target = total * fraction
  const out: Coord[] = [coords[0]]
  let travelled = 0

  for (let i = 0; i < lengths.length; i += 1) {
    if (travelled + lengths[i] <= target) {
      out.push(coords[i + 1])
      travelled += lengths[i]
      continue
    }
    const ratio = lengths[i] > 0 ? (target - travelled) / lengths[i] : 0
    const from = coords[i]
    const to = coords[i + 1]
    out.push([from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio])
    break
  }
  return out
}

interface Options {
  map: MapLibreMap | null
  /** Bumped on every style load; forces a full rebuild. */
  epoch: number
  routes: RoutePlan[]
  selectedId: ProfileId | null
  factorId: string
  factorScale: { value: string; color: string }[]
  motion: boolean
}

/**
 * Draws every alternative, colours the selected one by the chosen
 * accessibility factor, and animates selection changes with a draw-on reveal
 * plus a marching-ants flow along the active route.
 */
export function useRoutesOverlay({ map, epoch, routes, selectedId, factorId, factorScale, motion }: Options) {
  const revealFrame = useRef<number | null>(null)
  const flowTimer = useRef<number | null>(null)
  const lastRevealKey = useRef('')
  const routesRef = useRef(routes)
  routesRef.current = routes

  // ── Geometry: rebuild whenever the route set or basemap changes ──
  useEffect(() => {
    if (!styleReady(map)) return
    teardown(map)
    if (!routes.length) return

    // Added in a stable order; the selected route is raised above the others
    // by the styling effect using moveLayer, so selecting never rebuilds.
    const ordered = [...routes]

    for (const route of ordered) {
      map.addSource(`${GLOW_PREFIX}${route.id}`, { type: 'geojson', data: lineFeature(route.path) })
      map.addLayer({
        id: `${GLOW_PREFIX}${route.id}`,
        type: 'line',
        source: `${GLOW_PREFIX}${route.id}`,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': route.color,
          'line-width': 18,
          'line-blur': 14,
          'line-opacity': 0.55,
        },
      })
    }

    for (const route of ordered) {
      map.addSource(`${BAND_PREFIX}${route.id}`, {
        type: 'geojson',
        data: collection(
          route.segments.map((segment) =>
            lineFeature(segment.coordinates, segmentProperties(route.id, segment, route.color)),
          ),
        ),
      })
      map.addLayer({
        id: `${BAND_PREFIX}${route.id}`,
        type: 'line',
        source: `${BAND_PREFIX}${route.id}`,
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 4.5, 18, 9],
          'line-opacity': 0.92,
        },
      })
    }

    for (const route of ordered) {
      map.addSource(`${CORE_PREFIX}${route.id}`, { type: 'geojson', data: lineFeature(route.path) })
      map.addLayer({
        id: `${CORE_PREFIX}${route.id}`,
        type: 'line',
        source: `${CORE_PREFIX}${route.id}`,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': route.color, 'line-width': 2.6, 'line-opacity': 0.95 },
      })
    }

    map.addSource(FLOW_SOURCE, { type: 'geojson', data: EMPTY })
    map.addLayer({
      id: FLOW_LAYER,
      type: 'line',
      source: FLOW_SOURCE,
      layout: { 'line-cap': 'butt', 'line-join': 'round', visibility: 'none' },
      paint: {
        'line-color': '#ffffff',
        'line-width': 2.4,
        'line-opacity': 0.8,
        'line-dasharray': DASH_SEQUENCE[0],
      },
    })

    map.addSource(HIGHLIGHT_SOURCE, { type: 'geojson', data: EMPTY })
    map.addLayer({
      id: HIGHLIGHT_LAYER,
      type: 'line',
      source: HIGHLIGHT_SOURCE,
      layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
      paint: { 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 0.32, 'line-blur': 3 },
    })
  }, [map, epoch, routes])

  // ── Selection styling, draw-on reveal and flow animation ──
  useEffect(() => {
    if (!styleReady(map) || !routes.length) return

    const selected = routes.find((route) => route.id === selectedId) ?? null

    for (const route of routes) {
      const isSelected = selected ? route.id === selected.id : true
      const dimmed = selected !== null && !isSelected

      if (map.getLayer(`${GLOW_PREFIX}${route.id}`)) {
        map.setPaintProperty(`${GLOW_PREFIX}${route.id}`, 'line-opacity', dimmed ? 0.1 : isSelected ? 0.6 : 0.4)
        map.setPaintProperty(`${GLOW_PREFIX}${route.id}`, 'line-width', dimmed ? 12 : isSelected ? 20 : 16)
      }
      if (map.getLayer(`${BAND_PREFIX}${route.id}`)) {
        map.setPaintProperty(`${BAND_PREFIX}${route.id}`, 'line-opacity', dimmed ? 0.14 : isSelected ? 0.95 : 0.7)
      }
      if (map.getLayer(`${CORE_PREFIX}${route.id}`)) {
        map.setPaintProperty(`${CORE_PREFIX}${route.id}`, 'line-opacity', dimmed ? 0.25 : 1)
        map.setPaintProperty(`${CORE_PREFIX}${route.id}`, 'line-width', isSelected ? 3 : 2)
      }
    }

    const coreSource = selected ? (map.getSource(`${CORE_PREFIX}${selected.id}`) as GeoJSONSource | undefined) : undefined
    const revealKey = selected
      ? `${routes.map((route) => route.id).join(',')}|${selected.id}|${selected.total_distance_m}`
      : ''

    if (coreSource && selected) {
      const shouldAnimate = motion && revealKey !== lastRevealKey.current
      lastRevealKey.current = revealKey
      const bandOpacity = selected ? 0.95 : 0.7
      const bandId = `${BAND_PREFIX}${selected.id}`
      const coreId = `${CORE_PREFIX}${selected.id}`

      if (revealFrame.current) cancelAnimationFrame(revealFrame.current)

      if (shouldAnimate) {
        const start = performance.now()
        const full = selected.path
        if (map.getLayer(bandId)) map.setPaintProperty(bandId, 'line-opacity', 0)
        if (map.getLayer(coreId)) map.setPaintProperty(coreId, 'line-width', 3.4)

        const step = (now: number) => {
          const t = Math.min(1, (now - start) / REVEAL_MS)
          const eased = 1 - Math.pow(1 - t, 3)
          coreSource.setData(lineFeature(sliceCoords(full, eased)))
          if (t < 1) {
            revealFrame.current = requestAnimationFrame(step)
            return
          }
          if (map.getLayer(bandId)) map.setPaintProperty(bandId, 'line-opacity', bandOpacity)
          if (map.getLayer(coreId)) map.setPaintProperty(coreId, 'line-width', 3)
        }
        revealFrame.current = requestAnimationFrame(step)
      } else {
        coreSource.setData(lineFeature(selected.path))
      }
    }

    // Raise the selected route above its siblings, then the flow and hover
    // layers above everything.
    for (const route of routes) {
      if (selected && route.id !== selected.id) continue
      for (const prefix of [GLOW_PREFIX, BAND_PREFIX, CORE_PREFIX]) {
        const id = `${prefix}${route.id}`
        if (map.getLayer(id)) map.moveLayer(id)
      }
    }
    if (map.getLayer(FLOW_LAYER)) map.moveLayer(FLOW_LAYER)
    if (map.getLayer(HIGHLIGHT_LAYER)) map.moveLayer(HIGHLIGHT_LAYER)

    // ── Flow layer follows the selection ──
    const flowSource = map.getSource(FLOW_SOURCE) as GeoJSONSource | undefined
    const flowOn = Boolean(selected) && motion
    if (flowSource) {
      flowSource.setData(selected && flowOn ? lineFeature(selected.path) : EMPTY)
      map.setLayoutProperty(FLOW_LAYER, 'visibility', flowOn ? 'visible' : 'none')
    }

    if (flowTimer.current) {
      window.clearInterval(flowTimer.current)
      flowTimer.current = null
    }
    if (flowOn) {
      let stepIndex = 0
      flowTimer.current = window.setInterval(() => {
        stepIndex = (stepIndex + 1) % DASH_SEQUENCE.length
        if (map.getLayer(FLOW_LAYER)) {
          map.setPaintProperty(FLOW_LAYER, 'line-dasharray', DASH_SEQUENCE[stepIndex])
        }
      }, FLOW_INTERVAL_MS)
    }

    return () => {
      if (flowTimer.current) window.clearInterval(flowTimer.current)
      flowTimer.current = null
    }
  }, [map, epoch, routes, selectedId, motion])

  // ── Recolour segments when the factor mode changes ──
  useEffect(() => {
    if (!styleReady(map)) return

    for (const route of routes) {
      const source = map.getSource(`${BAND_PREFIX}${route.id}`) as GeoJSONSource | undefined
      if (!source) continue

      source.setData(
        collection(
          route.segments.map((segment) =>
            lineFeature(segment.coordinates, {
              ...segmentProperties(route.id, segment, route.color),
              color: factorId === 'route' ? route.color : segmentColor(segment, factorId, factorScale),
            }),
          ),
        ),
      )
    }
  }, [map, epoch, routes, factorId, factorScale])

  useEffect(
    () => () => {
      if (revealFrame.current) cancelAnimationFrame(revealFrame.current)
      if (flowTimer.current) window.clearInterval(flowTimer.current)
    },
    [],
  )
}

/** Highlight an arbitrary coordinate run (hover sync from the panels). */
export function highlightCoords(map: MapLibreMap | null, coords: Coord[] | null) {
  if (!styleReady(map)) return
  const source = map.getSource(HIGHLIGHT_SOURCE) as GeoJSONSource | undefined
  if (!source || !map.getLayer(HIGHLIGHT_LAYER)) return

  if (!coords || coords.length < 2) {
    source.setData(EMPTY)
    map.setLayoutProperty(HIGHLIGHT_LAYER, 'visibility', 'none')
    return
  }
  source.setData(lineFeature(coords))
  map.setLayoutProperty(HIGHLIGHT_LAYER, 'visibility', 'visible')
}

/** Read the route/segment a map click landed on. */
export function segmentFromFeature(feature: MapGeoJSONFeature): { routeId: string; index: number } | null {
  const routeId = feature.properties?.route as string | undefined
  const index = feature.properties?.index
  if (!routeId || index === undefined || index === null) return null
  return { routeId, index: Number(index) }
}
