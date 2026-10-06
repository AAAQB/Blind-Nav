import { useEffect, useRef } from 'react'
import type { Map as MapLibreMap, SkySpecification } from 'maplibre-gl'
import type { ThemeId } from '../../lib/theme'
import { styleReady } from './useMapLibre'

const TERRAIN_SOURCE = 'bn-terrain'
const BUILDINGS_LAYER = 'bn-3d-buildings'

/**
 * Terrarium-encoded DEM tiles (Mapzen / AWS Open Data). Free and key-free, and
 * small enough (~45 KB) that switching 3D on feels immediate.
 */
const TERRAIN_TILES = [
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
]
const TERRAIN_ATTRIBUTION =
  'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/">Mapzen / AWS Open Data</a>'

const EXTRUSION_COLOR: Record<ThemeId, string> = {
  dark: '#2b3448',
  light: '#d9d3c8',
  contrast: '#242424',
}

const SKY: Record<ThemeId, SkySpecification> = {
  dark: {
    'sky-color': '#070c18',
    'horizon-color': '#16203c',
    'fog-color': '#0d1730',
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.7,
    'fog-ground-blend': 0.4,
  },
  light: {
    'sky-color': '#a9cdf2',
    'horizon-color': '#e6eef8',
    'fog-color': '#eef3fa',
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.6,
    'fog-ground-blend': 0.4,
  },
  contrast: {
    'sky-color': '#000000',
    'horizon-color': '#000000',
    'fog-color': '#000000',
    'sky-horizon-blend': 1,
    'horizon-fog-blend': 1,
    'fog-ground-blend': 0.2,
  },
}

interface Options {
  map: MapLibreMap | null
  /** Bumped on every style load; forces a rebuild after a basemap swap. */
  epoch: number
  enabled: boolean
  /** False for raster basemaps, which carry no building geometry. */
  vectorBasemap: boolean
  theme: ThemeId
}

/** First vector source declared by the active style, or null for raster maps. */
function findVectorSource(map: MapLibreMap): string | null {
  const sources = map.getStyle()?.sources ?? {}
  for (const [id, source] of Object.entries(sources)) {
    if ((source as { type?: string }).type === 'vector') return id
  }
  return null
}

/** Keep extruded buildings underneath the route overlays. */
function routeLayerAnchor(map: MapLibreMap): string | undefined {
  const layers = map.getStyle()?.layers ?? []
  return layers.find((layer) => layer.id.startsWith('bn-glow-'))?.id
}

/**
 * Real 3D for the map: terrain relief from a DEM plus extruded buildings on
 * vector basemaps. Raster basemaps still get terrain, so satellite imagery
 * draped over hills looks correct.
 */
export function useThreeD({ map, epoch, enabled, vectorBasemap, theme }: Options) {
  // ── Terrain + atmosphere ──
  useEffect(() => {
    if (!styleReady(map)) return

    if (!enabled) {
      try {
        map.setTerrain(null)
      } catch {
        /* the map may already be disposed */
      }
      return
    }

    try {
      if (!map.getSource(TERRAIN_SOURCE)) {
        map.addSource(TERRAIN_SOURCE, {
          type: 'raster-dem',
          tiles: TERRAIN_TILES,
          encoding: 'terrarium',
          tileSize: 256,
          maxzoom: 15,
          attribution: TERRAIN_ATTRIBUTION,
        })
      }
      map.setTerrain({ source: TERRAIN_SOURCE, exaggeration: 1.25 })
    } catch {
      // A DEM failure must not break the rest of 3D; buildings still work.
    }

    return () => {
      try {
        map.setTerrain(null)
      } catch {
        /* the map may already be disposed */
      }
    }
  }, [map, epoch, enabled])

  // ── Sky / atmosphere, only meaningful with terrain or a pitched camera ──
  // Only clear a sky we set ourselves: passing an undefined spec to a style
  // that never had one makes MapLibre validate null blend values and warn.
  const skyApplied = useRef(false)
  useEffect(() => {
    if (!styleReady(map)) {
      skyApplied.current = false
      return
    }
    try {
      if (enabled) {
        map.setSky(SKY[theme])
        skyApplied.current = true
      } else if (skyApplied.current) {
        map.setSky(undefined as unknown as SkySpecification)
        skyApplied.current = false
      }
    } catch {
      /* older style spec: skip */
    }
  }, [map, epoch, enabled, theme])

  // ── Extruded buildings ──
  useEffect(() => {
    if (!styleReady(map)) return

    const remove = () => {
      // The map may already be disposed when this runs as an unmount cleanup.
      try {
        if (map.getLayer(BUILDINGS_LAYER)) map.removeLayer(BUILDINGS_LAYER)
      } catch {
        /* nothing left to remove */
      }
    }

    if (!enabled || !vectorBasemap) {
      remove()
      return remove
    }

    const sourceId = findVectorSource(map)
    if (!sourceId) return remove

    try {
      if (!map.getLayer(BUILDINGS_LAYER)) {
        map.addLayer(
          {
            id: BUILDINGS_LAYER,
            type: 'fill-extrusion',
            source: sourceId,
            'source-layer': 'building',
            minzoom: 13,
            paint: {
              'fill-extrusion-color': EXTRUSION_COLOR[theme] ?? '#2b3448',
              // Grow the blocks in as you zoom, so a tilted view at city scale
              // is not a wall of towers.
              'fill-extrusion-height': [
                'interpolate', ['linear'], ['zoom'],
                13, 0,
                15.5, ['get', 'render_height'],
              ],
              'fill-extrusion-base': ['get', 'render_min_height'],
              'fill-extrusion-opacity': theme === 'contrast' ? 0.95 : 0.82,
              'fill-extrusion-vertical-gradient': true,
            },
          },
          routeLayerAnchor(map),
        )
      } else {
        map.setPaintProperty(BUILDINGS_LAYER, 'fill-extrusion-color', EXTRUSION_COLOR[theme] ?? '#2b3448')
      }
    } catch {
      remove()
    }

    return remove
  }, [map, epoch, enabled, vectorBasemap, theme])
}
