import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { factorText, factorValueText, profileText, useI18n } from '../../lib/i18n'
import { useTheme } from '../../lib/theme'
import { BASEMAPS, basemapById } from '../../lib/basemaps'
import type { Coord, LatLon, Meta, ProfileId, RiskEvent, RoutePlan, Segment, Severity } from '../../lib/types'
import { Icon } from '../ui/Icon'
import { IconButton, Tooltip } from '../ui/Primitives'
import { highlightCoords, segmentFromFeature, useRoutesOverlay } from './useRoutesOverlay'
import { useEndpointMarkers, useRiskMarkers } from './useMapMarkers'
import { useMapLibre } from './useMapLibre'
import { useThreeD } from './useThreeD'

export interface FocusRequest {
  coords: Coord[]
  key: number
  padding?: number
  duration?: number
}

export interface SegmentHit {
  routeId: ProfileId
  index: number
  segment: Segment
}

/** Half-width of the click box used to hit a route band, in pixels. */
const HIT_TOLERANCE_PX = 7
/** Camera tilt used by the 3D view. */
const THREE_D_PITCH = 52

/**
 * Width of the vertical control column (basemap menu, 3D, compass) and the gap
 * between map chrome and the panels. The legend keeps this much room clear so
 * the two never fight for the same corner.
 */
const CONTROLS_WIDTH = 156
const CHROME_GAP = 12

/** Space the surrounding panels leave free for map chrome, in CSS pixels. */
export interface ChromeInsets {
  left: number
  right: number
  bottom: number
}

interface Props {
  meta: Meta | null
  routes: RoutePlan[]
  selectedId: ProfileId | null
  onSelectRoute: (id: ProfileId) => void
  factorId: string
  onFactorChange: (factorId: string) => void
  start: LatLon | null
  end: LatLon | null
  picking: 'start' | 'end' | null
  onMapPick: (point: LatLon) => void
  onMarkerDrag: (kind: 'start' | 'end', point: LatLon) => void
  camera: { lat: number; lon: number; zoom: number } | null
  focus: FocusRequest | null
  hoverCoords: Coord[] | null
  activeRisk: RiskEvent | null
  onRiskSelect: (risk: RiskEvent | null) => void
  showRiskPins: boolean
  riskFloor: Severity
  onSegmentPick: (hit: SegmentHit | null) => void
  fitPadding: { top: number; right: number; bottom: number; left: number }
  basemapId: string
  onBasemapChange: (id: string) => void
  threeD: boolean
  onThreeDChange: (value: boolean) => void
  chrome: ChromeInsets
}

export function MapView({
  meta,
  routes,
  selectedId,
  onSelectRoute,
  factorId,
  onFactorChange,
  start,
  end,
  picking,
  onMapPick,
  onMarkerDrag,
  camera,
  focus,
  hoverCoords,
  activeRisk,
  onRiskSelect,
  showRiskPins,
  riskFloor,
  onSegmentPick,
  fitPadding,
  basemapId,
  onBasemapChange,
  threeD,
  onThreeDChange,
  chrome,
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const { theme, motion } = useTheme()
  const { t } = useI18n()
  const [basemapNoticeDismissed, setBasemapNoticeDismissed] = useState(false)

  const basemap = basemapById(basemapId)

  const { map, epoch, basemapError } = useMapLibre(container, {
    style: basemap.style,
    center: camera ?? { lat: 3.1489, lon: 101.6957 },
    zoom: camera?.zoom ?? 14,
    pitch: threeD ? THREE_D_PITCH : 0,
    animate: motion,
  })

  useThreeD({ map, epoch, enabled: threeD, vectorBasemap: basemap.vector, theme })

  const selectedRoute = routes.find((route) => route.id === selectedId) ?? routes[0] ?? null
  const factorScale = useMemo(() => {
    if (!meta) return []
    const factor = meta.segment_factors.find((item) => item.id === factorId)
    return factor?.scale ?? []
  }, [meta, factorId])

  useRoutesOverlay({
    map,
    epoch,
    routes,
    selectedId: selectedRoute?.id ?? null,
    factorId,
    factorScale,
    motion,
  })

  useEndpointMarkers({ map, start, end, onDragEnd: onMarkerDrag, animate: motion })

  useRiskMarkers({
    map,
    risks: selectedRoute?.risks ?? [],
    minSeverity: riskFloor,
    onSelect: (risk) => onRiskSelect(risk),
    hidden: !showRiskPins,
    active: activeRisk,
  })

  // Keep the last click handler in a ref so the map listener is registered once.
  const handlers = useRef({ picking, onMapPick, onSegmentPick, routes, selectedRoute })
  handlers.current = { picking, onMapPick, onSegmentPick, routes, selectedRoute }

  useEffect(() => {
    if (!map) return

    const onClick = (event: maplibregl.MapMouseEvent) => {
      const { picking: mode, onMapPick: pick, onSegmentPick: segmentPick, routes: all, selectedRoute: current } =
        handlers.current

      if (mode) {
        pick({ lat: Number(event.lngLat.lat.toFixed(6)), lon: Number(event.lngLat.lng.toFixed(6)) })
        return
      }

      const layerIds = all
        .filter((route) => !current || route.id === current.id)
        .map((route) => `bn-band-${route.id}`)
        .filter((id) => map.getLayer(id))

      if (!layerIds.length) {
        segmentPick(null)
        return
      }

      const features = map.queryRenderedFeatures(
        [
          [event.point.x - HIT_TOLERANCE_PX, event.point.y - HIT_TOLERANCE_PX],
          [event.point.x + HIT_TOLERANCE_PX, event.point.y + HIT_TOLERANCE_PX],
        ],
        { layers: layerIds },
      )
      const hit = features.map(segmentFromFeature).find(Boolean)
      if (!hit) {
        segmentPick(null)
        return
      }
      const route = all.find((item) => item.id === hit.routeId)
      const segment = route?.segments.find((item) => item.index === hit.index)
      if (route && segment) segmentPick({ routeId: route.id, index: hit.index, segment })
    }

    const onMove = (event: maplibregl.MapMouseEvent) => {
      if (handlers.current.picking) return
      const layerIds = handlers.current.routes.map((route) => `bn-band-${route.id}`).filter((id) => map.getLayer(id))
      const hits = layerIds.length
        ? map.queryRenderedFeatures(
            [
              [event.point.x - HIT_TOLERANCE_PX, event.point.y - HIT_TOLERANCE_PX],
              [event.point.x + HIT_TOLERANCE_PX, event.point.y + HIT_TOLERANCE_PX],
            ],
            { layers: layerIds },
          )
        : []
      map.getCanvas().style.cursor = hits.length ? 'pointer' : ''
    }

    map.on('click', onClick)
    map.on('mousemove', onMove)
    return () => {
      map.off('click', onClick)
      map.off('mousemove', onMove)
    }
  }, [map])

  // Cursor feedback while arming a pick.
  useEffect(() => {
    if (!map) return
    map.getCanvas().style.cursor = picking ? 'crosshair' : ''
  }, [map, picking])

  // Fit the viewport to the freshly computed routes.
  const routeSignature = routes.map((route) => `${route.id}:${route.total_distance_m}`).join('|')
  useEffect(() => {
    if (!map || !routes.length) return
    const coords = routes.flatMap((route) => route.path)
    const lats = coords.map((coord) => coord[0])
    const lons = coords.map((coord) => coord[1])
    if (!lats.length) return

    map.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      {
        padding: fitPadding,
        duration: motion ? 900 : 0,
        maxZoom: 17,
      },
    )
    // fitPadding is intentionally excluded: it would re-fit on every resize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, routeSignature, motion])

  // Area / search driven camera moves.
  useEffect(() => {
    if (!map || !camera) return
    map.flyTo({
      center: [camera.lon, camera.lat],
      zoom: camera.zoom,
      duration: motion ? 1100 : 0,
      essential: true,
    })
  }, [map, camera, motion])

  // Explicit focus requests (hover a direction step, jump to a hazard…).
  useEffect(() => {
    if (!map || !focus || !focus.coords.length) return
    const lats = focus.coords.map((coord) => coord[0])
    const lons = focus.coords.map((coord) => coord[1])
    const padding = focus.padding ?? 140
    map.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      { padding, duration: focus.duration ?? (motion ? 750 : 0), maxZoom: 18, essential: true },
    )
  }, [map, focus, motion])

  // Hover sync from the results panels.
  useEffect(() => {
    highlightCoords(map, hoverCoords)
  }, [map, hoverCoords, epoch])

  const pickingLabel =
    picking === 'start' ? t('map.pickingStart') : picking === 'end' ? t('map.pickingEnd') : null
  const showVectorHint = threeD && !basemap.vector

  return (
    <div className="relative h-full w-full">
      {/* The map container must stay in normal flow: MapLibre's own
          .maplibregl-map rule sets position:relative unlayered, which would
          beat Tailwind's layered `absolute` and collapse the canvas. */}
      <div
        ref={container}
        className="h-full w-full"
        style={
          {
            '--bn-ctrl-right': `${chrome.right + CHROME_GAP}px`,
            '--bn-ctrl-left': `${chrome.left + CHROME_GAP}px`,
            '--bn-ctrl-bottom': `${chrome.bottom + CHROME_GAP}px`,
          } as CSSProperties
        }
      />

      {/* Soft vignette keeps focus on the route without dimming the basemap. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 0%, transparent 45%, color-mix(in oklab, var(--bn-bg) 55%, transparent) 100%)',
        }}
      />

      {pickingLabel ? (
        <div className="anim-rise pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2">
          <div className="glass flex items-center gap-2 px-3.5 py-2 text-[12px] font-semibold">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-accent text-bg">
              <Icon name="crosshair" size={11} />
            </span>
            {pickingLabel}
            <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-muted">Esc</kbd>
          </div>
        </div>
      ) : null}

      {basemapError && !basemapNoticeDismissed ? (
        <div className="anim-rise absolute left-1/2 top-16 z-30 -translate-x-1/2">
          <div className="glass flex max-w-[52ch] items-start gap-2 px-3.5 py-2.5 text-[11.5px]">
            <Icon name="warning" size={14} className="mt-0.5 text-warn" />
            <span className="min-w-0 flex-1">
              <strong className="font-semibold">{t('map.tilesFailed')}</strong> {t('map.tilesFailedBody')}
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                {BASEMAPS.filter((item) => item.id !== basemapId)
                  .slice(0, 3)
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onBasemapChange(item.id)}
                      className="rounded-chip border border-line-strong px-2 py-0.5 text-[10.5px] font-semibold text-fg transition-colors hover:border-accent hover:text-accent"
                    >
                      {t(item.labelKey)}
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={() => setBasemapNoticeDismissed(true)}
                  className="rounded-chip px-2 py-0.5 text-[10.5px] font-semibold text-subtle transition-colors hover:text-fg"
                >
                  {t('map.dismiss')}
                </button>
              </span>
            </span>
          </div>
        </div>
      ) : null}

      {routes.length > 1 ? (
        <RouteSwitcher routes={routes} selectedId={selectedRoute?.id ?? null} onSelect={onSelectRoute} />
      ) : null}

      <MapLegend
        meta={meta}
        factorId={factorId}
        onFactorChange={onFactorChange}
        animate={motion}
        chrome={chrome}
      />

      <div
        className="absolute z-20 flex flex-col items-end gap-1.5"
        style={{ right: chrome.right + CHROME_GAP, bottom: chrome.bottom + CHROME_GAP }}
      >
        <BasemapMenu basemapId={basemapId} onChange={onBasemapChange} />

        <div className="glass flex items-center gap-1 p-1">
          <Tooltip label={threeD ? t('map.flat') : t('map.tilt3d')}>
            <button
              type="button"
              onClick={() => onThreeDChange(!threeD)}
              aria-pressed={threeD}
              className={[
                'flex items-center gap-1.5 rounded-chip px-2.5 py-1.5 text-[11px] font-semibold transition-colors duration-200',
                threeD ? 'bg-accent text-bg' : 'text-muted hover:text-fg',
              ].join(' ')}
            >
              <Icon name="cube" size={13} />
              3D
            </button>
          </Tooltip>
          <IconButton
            icon="compass"
            label={t('map.resetNorth')}
            onClick={() => map?.resetNorth({ duration: motion ? 600 : 0 })}
          />
        </div>
      </div>

      {showVectorHint ? (
        <div className="anim-rise absolute left-1/2 top-16 z-20 -translate-x-1/2">
          <div className="glass flex max-w-[46ch] items-center gap-2 px-3 py-2 text-[11px] text-warn">
            <Icon name="info" size={13} />
            <span>{t('map.no3dBuildings')}</span>
            <button
              type="button"
              onClick={() => onBasemapChange('liberty')}
              className="rounded-chip border border-line-strong px-2 py-0.5 text-[10.5px] font-semibold text-fg transition-colors hover:border-accent hover:text-accent"
            >
              {t('map.switchToVector')}
            </button>
          </div>
        </div>
      ) : null}

      <MapStats routes={routes} meta={meta} map={map} chrome={chrome} />
    </div>
  )
}

/* ── Overlays ── */

function BasemapMenu({ basemapId, onChange }: { basemapId: string; onChange: (id: string) => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const active = basemapById(basemapId)

  return (
    <>
      {open ? (
        <div
          className="glass anim-rise flex flex-col p-1"
          role="group"
          aria-label={t('map.basemapGroup')}
          style={{ width: CONTROLS_WIDTH - 8 }}
        >
          {BASEMAPS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onChange(item.id)
                setOpen(false)
              }}
              aria-pressed={basemapId === item.id}
              className={[
                'flex items-center justify-between gap-2 rounded-chip px-2.5 py-1.5 text-left text-[11px] font-semibold transition-colors duration-200',
                basemapId === item.id ? 'bg-accent text-bg' : 'text-muted hover:bg-surface-2 hover:text-fg',
              ].join(' ')}
            >
              <span className="truncate">{t(item.labelKey)}</span>
              {item.vector ? (
                <span aria-hidden className="shrink-0 text-[9px] opacity-70">
                  3D
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      <div className="glass p-1" style={{ width: CONTROLS_WIDTH }}>
        <Tooltip label={t(active.hintKey)}>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={`${t('map.basemapGroup')}: ${t(active.labelKey)}`}
            className="flex w-full items-center gap-1.5 rounded-chip px-2.5 py-1.5 text-[11px] font-semibold text-fg transition-colors duration-200 hover:text-accent"
          >
            <Icon name={active.vector ? 'layers' : 'globe'} size={13} />
            <span className="truncate">{t(active.labelKey)}</span>
            <Icon name={open ? 'chevron-down' : 'chevron-up'} size={12} className="ml-auto text-subtle" />
          </button>
        </Tooltip>
      </div>
    </>
  )
}

function RouteSwitcher({
  routes,
  selectedId,
  onSelect,
}: {
  routes: RoutePlan[]
  selectedId: ProfileId | null
  onSelect: (id: ProfileId) => void
}) {
  const { lang } = useI18n()

  return (
    <div className="anim-rise absolute left-1/2 top-4 z-20 -translate-x-1/2">
      <div className="glass flex items-center gap-1 p-1">
        {routes.map((route) => {
          const active = route.id === selectedId
          const text = profileText(lang, route.id)
          return (
            <Tooltip key={route.id} label={text.label}>
              <button
                type="button"
                onClick={() => onSelect(route.id)}
                aria-pressed={active}
                className={[
                  'flex items-center gap-1.5 rounded-chip px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-200',
                  active ? 'text-bg' : 'text-muted hover:text-fg',
                ].join(' ')}
                style={active ? { background: route.color } : undefined}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: active ? 'rgba(0,0,0,.55)' : route.color }}
                />
                {text.short}
                <span className="tnum opacity-70">{route.score}</span>
              </button>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}

function MapLegend({
  meta,
  factorId,
  onFactorChange,
  animate,
  chrome,
}: {
  meta: Meta | null
  factorId: string
  onFactorChange: (id: string) => void
  animate: boolean
  chrome: ChromeInsets
}) {
  const { t, lang } = useI18n()
  const [open, setOpen] = useState(false)
  const factor = meta?.segment_factors.find((item) => item.id === factorId)
  const options = [{ id: 'route', label: t('legend.routeColours'), scale: [] as { value: string; color: string }[] }].concat(
    (meta?.segment_factors ?? []).map((item) => ({
      id: item.id,
      label: factorText(lang, item.id).label,
      scale: item.scale,
    })),
  )

  const currentLabel =
    factorId === 'route' ? t('legend.routeColours') : factorText(lang, factorId).label

  return (
    <div
      className="pointer-events-none absolute z-20 flex flex-col items-start"
      style={{
        left: chrome.left + CHROME_GAP,
        bottom: chrome.bottom + CHROME_GAP,
        right: chrome.right + CHROME_GAP + CONTROLS_WIDTH + 8,
      }}
    >
      <div className="glass pointer-events-auto overflow-hidden">
        <Tooltip label={open ? '' : t('map.legendHint')}>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="flex w-fit items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted transition-colors hover:text-fg"
          >
            <Icon name="layers" size={13} />
            {currentLabel}
            <Icon name={open ? 'chevron-down' : 'chevron-up'} size={13} className="ml-1" />
          </button>
        </Tooltip>

        {open ? (
          <div className="anim-fade flex w-full min-w-[196px] max-w-[320px] flex-col gap-2 border-t border-line px-3 py-2.5">
            <div className="flex flex-wrap gap-1">
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onFactorChange(option.id)
                    setOpen(false)
                  }}
                  aria-pressed={factorId === option.id}
                  className={[
                    'rounded-chip border px-2 py-1 text-[11px] font-medium transition-all duration-200',
                    factorId === option.id
                      ? 'border-accent bg-accent text-bg'
                      : 'border-line text-muted hover:border-line-strong hover:text-fg',
                  ].join(' ')}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {factor ? (
              <>
                <p className="max-w-[46ch] text-[10.5px] leading-snug text-subtle">
                  {factorText(lang, factor.id).description}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {factor.scale.map((stop) => (
                    <span key={stop.value} className="flex items-center gap-1.5 text-[10.5px] text-muted">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: stop.color, boxShadow: animate ? `0 0 8px ${stop.color}88` : undefined }}
                      />
                      {factorValueText(lang, factor.id, stop.value)}
                    </span>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function MapStats({
  routes,
  meta,
  map,
  chrome,
}: {
  routes: RoutePlan[]
  meta: Meta | null
  map: MapLibreMap | null
  chrome: ChromeInsets
}) {
  const { t } = useI18n()
  const [zoom, setZoom] = useState<number | null>(null)

  useEffect(() => {
    if (!map) return
    const update = () => setZoom(map.getZoom())
    update()
    map.on('zoom', update)
    return () => {
      map.off('zoom', update)
    }
  }, [map])

  if (!routes.length && !meta) return null

  return (
    <div
      className="pointer-events-none absolute top-4 z-10 hidden flex-col items-start gap-1 text-[10.5px] text-subtle md:flex"
      style={{ left: chrome.left + CHROME_GAP }}
    >
      <span className="glass-soft px-2.5 py-1.5">
        {meta
          ? `${t('map.nodeStats', { nodes: meta.graph.nodes.toLocaleString(), edges: meta.graph.edges.toLocaleString() })}${
              zoom !== null ? ` · z${zoom.toFixed(1)}` : ''
            }`
          : '—'}
      </span>
      {routes.length ? (
        <span className="glass-soft px-2.5 py-1.5">
          {t('map.routeStats', {
            n: routes.length,
            algo: routes[0].algorithm === 'bidirectional_a*' ? 'Bidirectional A*' : 'Weighted A*',
          })}
        </span>
      ) : null}
    </div>
  )
}
