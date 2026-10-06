import { useEffect, useRef, useState } from 'react'
import maplibregl, { type Map as MapLibreMap, type StyleSpecification } from 'maplibre-gl'
import { useTheme } from '../../lib/theme'

interface Options {
  style: string | StyleSpecification
  center: { lat: number; lon: number }
  zoom: number
  pitch: number
  /** When false the map stops animating camera moves (reduced motion). */
  animate: boolean
}

interface Result {
  map: MapLibreMap | null
  /** Bumped on every style load so dependants can re-add their layers. */
  epoch: number
  error: string | null
  /** Set when the basemap itself could not be fetched. */
  basemapError: string | null
}

/**
 * Readiness check for code that adds sources, layers or terrain.
 *
 * `map.isStyleLoaded()` also waits for every source, so it reports false for a
 * long time after a style swap — and it flips to false *while* an effect that
 * just added a tiled source (terrain, for example) is still running, which
 * makes sibling effects skip their work forever. Overlay bookkeeping only needs
 * the style to exist; effects keyed on `epoch` re-run when it truly loads.
 */
export function styleReady(map: MapLibreMap | null): map is MapLibreMap {
  return !!map && !!map.getStyle()
}

/**
 * Creates the MapLibre instance once and keeps the basemap in sync with the
 * selected style. Custom overlays are torn down by a style swap, so callers
 * subscribe to `epoch` and re-attach on every bump.
 */
export function useMapLibre(
  container: React.RefObject<HTMLDivElement | null>,
  { style, center, zoom, pitch, animate }: Options,
): Result {
  const mapRef = useRef<MapLibreMap | null>(null)
  const [map, setMap] = useState<MapLibreMap | null>(null)
  const [epoch, setEpoch] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [basemapError, setBasemapError] = useState<string | null>(null)
  const appliedStyle = useRef<string | StyleSpecification | null>(null)

  useEffect(() => {
    if (!container.current || mapRef.current) return

    let instance: MapLibreMap
    try {
      instance = new maplibregl.Map({
        container: container.current,
        style,
        center: [center.lon, center.lat],
        zoom,
        pitch,
        bearing: 0,
        antialias: true,
        attributionControl: { compact: true },
        // A restrained fade keeps basemap labels from flashing during swaps.
        fadeDuration: animate ? 220 : 0,
      })
    } catch (err) {
      setError((err as Error).message)
      return
    }

    instance.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    instance.addControl(new maplibregl.ScaleControl({ maxWidth: 90, unit: 'metric' }), 'bottom-left')
    instance.addControl(new maplibregl.FullscreenControl(), 'top-right')

    instance.on('load', () => setEpoch((value) => value + 1))
    instance.on('style.load', () => setEpoch((value) => value + 1))

    // OpenFreeMap's styles reference a few sprite images they do not ship
    // (e.g. `wood-pattern`). Supplying a transparent pixel keeps those pattern
    // layers invisible — which is what happens anyway — without MapLibre
    // warning on every tile.
    instance.on('styleimagemissing', (event: { id: string }) => {
      if (!event?.id || instance.hasImage(event.id)) return
      try {
        instance.addImage(event.id, { width: 1, height: 1, data: new Uint8Array(4) })
      } catch {
        /* the image may have appeared in the meantime */
      }
    })

    // Distinguish "the basemap provider is unreachable" from our own layer bugs:
    // only style/tile/glyph fetch failures set the banner.
    instance.on('error', (event: { error?: Error & { status?: number }; sourceId?: string }) => {
      const messageText = event?.error?.message ?? ''
      const isTileish =
        /style|tile|sprite|glyph|fetch|network|abort|load/i.test(messageText) ||
        typeof event?.error?.status === 'number'
      if (!isTileish) return
      if (/abort/i.test(messageText)) return
      setBasemapError(messageText || 'Basemap tiles could not be loaded')
    })

    appliedStyle.current = style
    mapRef.current = instance
    setMap(instance)

    // Handy in the dev console and for end-to-end checks; dropped from
    // production builds.
    if (import.meta.env.DEV) {
      ;(window as unknown as { __bnMap?: MapLibreMap }).__bnMap = instance
    }

    return () => {
      instance.remove()
      mapRef.current = null
      setMap(null)
    }
    // The map is created exactly once; later prop changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container])

  // Swap the basemap when the style changes. `diff: true` (MapLibre's default)
  // reuses layers across styles, but aborts with an internal AbortError when the
  // outgoing style is still fetching tiles, leaving the old basemap on screen. A
  // full rebuild always lands and costs one sprite fetch.
  useEffect(() => {
    const instance = mapRef.current
    if (!styleReady(instance) || appliedStyle.current === style) return

    appliedStyle.current = style
    setBasemapError(null)
    try {
      instance.setStyle(style as StyleSpecification | string, { diff: false })
      // A swap drops every layer we added ourselves, and MapLibre does not
      // reliably emit `style.load` for `setStyle`. Bump the generation here so
      // the overlays rebuild deterministically.
      setEpoch((value) => value + 1)
    } catch {
      appliedStyle.current = null
    }
  }, [style])

  const { theme } = useTheme()
  useEffect(() => {
    const instance = mapRef.current
    if (!instance) return
    // Keep the canvas in step with theme so tiles do not flash white.
    instance.getCanvas().style.background = theme === 'light' ? '#eaeff7' : theme === 'contrast' ? '#000' : '#05080f'
  }, [theme, map])

  // Tint the basemap background to the theme palette. Remote vector styles ship
  // their own background colour; matching it keeps the map edges seamless and
  // stops a borrowed palette from fighting the design tokens.
  useEffect(() => {
    const instance = mapRef.current
    if (!instance || !map) return
    const background = (instance.getStyle()?.layers ?? []).find((layer) => layer.type === 'background')
    if (!background) return
    const color = theme === 'light' ? '#eaeff7' : theme === 'contrast' ? '#000000' : '#05080f'
    try {
      instance.setPaintProperty(background.id, 'background-color', color)
    } catch {
      /* some styles expose a non-paint background; ignore */
    }
  }, [map, epoch, theme])

  // Tilt the camera for 3D. An animated camera change can stall when style
  // updates land in the same frame (terrain sources, extruded buildings), so
  // the target is verified afterwards and snapped into place if needed.
  useEffect(() => {
    const instance = mapRef.current
    if (!instance) return
    const duration = animate ? 700 : 0
    instance.easeTo({ pitch, duration })
    const settle = window.setTimeout(
      () => {
        try {
          if (Math.abs(instance.getPitch() - pitch) > 0.5) instance.setPitch(pitch)
        } catch {
          /* the map may already be disposed */
        }
      },
      duration + 400,
    )
    return () => window.clearTimeout(settle)
  }, [pitch, animate])

  // Keep the canvas in step with container size changes that are not window
  // resizes (panel and sheet layout switches). The resize is debounced until
  // layout settles: resizing while MapLibre is animating or rendering re-enters
  // its render loop, which throws and leaves the map frozen.
  useEffect(() => {
    const node = container.current
    if (!node || !map) return

    let timer = 0
    const observer = new ResizeObserver(() => {
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        timer = 0
        if (!map.getStyle()) return
        try {
          map.resize()
        } catch {
          /* the next layout change retries */
        }
      }, 160)
    })

    observer.observe(node)
    return () => {
      observer.disconnect()
      if (timer) window.clearTimeout(timer)
    }
  }, [container, map])

  return { map, epoch, error, basemapError }
}
