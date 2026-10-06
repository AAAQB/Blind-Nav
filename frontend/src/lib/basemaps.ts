import type { StyleSpecification } from 'maplibre-gl'
import type { StringKey } from './i18n'

export interface BasemapDef {
  id: string
  labelKey: StringKey
  hintKey: StringKey
  /** Vector styles are fetched from a style URL; raster styles ship inline. */
  style: StyleSpecification | string
  affinity: 'dark' | 'light'
  /** Vector basemaps can be dressed with extruded buildings; raster cannot. */
  vector: boolean
}

/**
 * Every basemap here is key-free.
 *
 * OpenFreeMap serves OpenMapTiles vector tiles without an API key or request
 * quota, and Esri's World Imagery is open for demo use, so the map keeps
 * working for anyone who clones the repository. The CARTO raster basemaps that
 * used to live here now answer with an "API key required" placeholder tile.
 */
const OPENFREEMAP_STYLES = 'https://tiles.openfreemap.org/styles'

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const ESRI_ATTRIBUTION =
  'Imagery &copy; <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics'

function osmRaster(): StyleSpecification {
  return {
    version: 8,
    name: 'OpenStreetMap',
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 19,
        attribution: OSM_ATTRIBUTION,
      },
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
  }
}

/** Satellite imagery with a transparent place-name overlay on top. */
function satellite(): StyleSpecification {
  const arcgis = (service: string) =>
    `https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`

  return {
    version: 8,
    name: 'Esri World Imagery',
    sources: {
      satellite: {
        type: 'raster',
        tiles: [arcgis('World_Imagery')],
        tileSize: 256,
        maxzoom: 19,
        attribution: ESRI_ATTRIBUTION,
      },
      labels: {
        type: 'raster',
        tiles: [arcgis('Reference/World_Boundaries_and_Places')],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Labels &copy; Esri',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#0b0f14' } },
      { id: 'satellite', type: 'raster', source: 'satellite' },
      { id: 'satellite-labels', type: 'raster', source: 'labels' },
    ],
  }
}

export const BASEMAPS: BasemapDef[] = [
  {
    id: 'dark',
    labelKey: 'map.basemap.night',
    hintKey: 'map.basemap.nightHint',
    style: `${OPENFREEMAP_STYLES}/dark`,
    affinity: 'dark',
    vector: true,
  },
  {
    id: 'fiord',
    labelKey: 'map.basemap.midnight',
    hintKey: 'map.basemap.midnightHint',
    style: `${OPENFREEMAP_STYLES}/fiord`,
    affinity: 'dark',
    vector: true,
  },
  {
    id: 'positron',
    labelKey: 'map.basemap.daylight',
    hintKey: 'map.basemap.daylightHint',
    style: `${OPENFREEMAP_STYLES}/positron`,
    affinity: 'light',
    vector: true,
  },
  {
    id: 'liberty',
    labelKey: 'map.basemap.liberty',
    hintKey: 'map.basemap.libertyHint',
    style: `${OPENFREEMAP_STYLES}/liberty`,
    affinity: 'light',
    vector: true,
  },
  {
    id: 'satellite',
    labelKey: 'map.basemap.satellite',
    hintKey: 'map.basemap.satelliteHint',
    style: satellite(),
    affinity: 'dark',
    vector: false,
  },
  {
    id: 'osm',
    labelKey: 'map.basemap.osm',
    hintKey: 'map.basemap.osmHint',
    style: osmRaster(),
    affinity: 'light',
    vector: false,
  },
]

export function basemapById(id: string): BasemapDef {
  return BASEMAPS.find((basemap) => basemap.id === id) ?? BASEMAPS[0]
}

export function defaultBasemapFor(theme: 'dark' | 'light' | 'contrast'): string {
  // The high-contrast theme wants the darkest available canvas, which is the
  // opposite of what "light theme" would suggest.
  if (theme === 'contrast') return 'dark'
  return theme === 'light' ? 'positron' : 'dark'
}
