import { useEffect, useRef } from 'react'
import maplibregl, { type Map as MapLibreMap, type Marker } from 'maplibre-gl'
import type { LatLon, RiskEvent, Severity } from '../../lib/types'
import { SEVERITY_COLOR } from '../../lib/risk'

const RISK_MARKER_LIMIT = 40

function iconSvg(name: 'start' | 'end' | 'flag' | 'steps' | 'warning' | 'moon' | 'grid' | 'layers' | 'trending' | 'compress' | 'road') {
  const paths: Record<string, string> = {
    start: 'M12 22s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12z',
    end: 'M12 22s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12z',
    flag: 'M5 22V4l14 5-14 5',
    steps: 'M3 20h4v-4h4v-4h4V8h4V4h2',
    warning: 'M10.3 3.6L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z',
    moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    layers: 'M12 2l9 5-9 5-9-5 9-5z',
    trending: 'M3 17l6-6 4 4 8-8',
    compress: 'M4 9h5V4M20 15h-5v5M4 15h5v5M20 9h-5V4',
    road: 'M4 22L8 2M20 22L16 2M12 5v3M12 12v3M12 19v2',
  }
  const fill = name === 'start' || name === 'end' || name === 'steps' || name === 'warning' || name === 'moon' ? 'currentColor' : 'none'
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]}"/></svg>`
}

const RISK_ICON: Record<string, Parameters<typeof iconSvg>[0]> = {
  steps: 'steps',
  no_sidewalk: 'road',
  unlit: 'moon',
  no_tactile: 'grid',
  rough_surface: 'layers',
  steep: 'trending',
  narrow: 'compress',
}

function endpointElement(kind: 'start' | 'end'): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'bn-pin'
  el.style.color = kind === 'start' ? '#22d3a6' : '#ff4d5f'
  el.innerHTML = `<span class="bn-pin__halo"></span><span class="bn-pin__dot"></span>`
  el.title = kind === 'start' ? 'Start — drag to move' : 'Destination — drag to move'
  el.setAttribute('role', 'img')
  el.setAttribute('aria-label', kind === 'start' ? 'Start point' : 'Destination')
  return el
}

function riskElement(severity: Severity, icon: string): HTMLDivElement {
  const color = SEVERITY_COLOR[severity]
  const el = document.createElement('div')
  el.className = 'bn-risk-pin'
  el.style.color = color
  el.innerHTML =
    (severity === 'high' ? '<span class="bn-risk-pin__pulse"></span>' : '') +
    `<span style="grid-area:1/1;display:grid;place-items:center;width:22px;height:22px;border-radius:999px;background:${color};border:2px solid var(--bn-surface-solid);box-shadow:0 4px 12px -4px rgba(0,0,0,.6)">${iconSvg(
      RISK_ICON[icon] ?? 'warning',
    )}</span>`
  return el
}

interface EndpointOptions {
  map: MapLibreMap | null
  start: LatLon | null
  end: LatLon | null
  onDragEnd: (kind: 'start' | 'end', point: LatLon) => void
  animate: boolean
}

/** Draggable start/end pins. */
export function useEndpointMarkers({ map, start, end, onDragEnd, animate }: EndpointOptions) {
  const markers = useRef<Record<'start' | 'end', Marker | null>>({ start: null, end: null })
  const dragHandler = useRef(onDragEnd)
  dragHandler.current = onDragEnd

  useEffect(() => {
    if (!map) return
    const created: Marker[] = []

    const attach = (kind: 'start' | 'end', point: LatLon | null) => {
      const existing = markers.current[kind]
      if (!point) {
        existing?.remove()
        markers.current[kind] = null
        return
      }
      if (existing) {
        existing.setLngLat([point.lon, point.lat])
        return
      }
      const marker = new maplibregl.Marker({
        element: endpointElement(kind),
        draggable: true,
        anchor: 'center',
      })
        .setLngLat([point.lon, point.lat])
        .addTo(map)

      marker.on('dragend', () => {
        const position = marker.getLngLat()
        dragHandler.current(kind, {
          lat: Number(position.lat.toFixed(6)),
          lon: Number(position.lng.toFixed(6)),
        })
      })
      markers.current[kind] = marker
      created.push(marker)
    }

    attach('start', start)
    attach('end', end)

    return () => {
      for (const marker of created) marker.remove()
      for (const kind of ['start', 'end'] as const) {
        if (markers.current[kind] && created.includes(markers.current[kind] as Marker)) {
          markers.current[kind] = null
        }
      }
    }
  }, [map, start, end, animate])
}

interface RiskOptions {
  map: MapLibreMap | null
  risks: RiskEvent[]
  minSeverity: Severity
  onSelect: (risk: RiskEvent) => void
  hidden: boolean
  /** Currently inspected hazard; a popup is anchored to it. */
  active?: RiskEvent | null
}

/** Hazard pins along the selected route, capped so the map stays readable. */
export function useRiskMarkers({ map, risks, minSeverity, onSelect, hidden, active }: RiskOptions) {
  const markerRefs = useRef<Marker[]>([])
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const selectHandler = useRef(onSelect)
  selectHandler.current = onSelect

  useEffect(() => {
    if (!map || hidden) return

    for (const marker of markerRefs.current) marker.remove()
    markerRefs.current = []

    const rank = { none: 0, low: 1, medium: 2, high: 3 } as const
    const visible = risks
      .filter((risk) => rank[risk.severity] >= rank[minSeverity])
      .slice(0, RISK_MARKER_LIMIT)

    for (const risk of visible) {
      const el = riskElement(risk.severity, risk.type)
      el.addEventListener('click', (event) => {
        event.stopPropagation()
        selectHandler.current(risk)
      })

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([risk.at[1], risk.at[0]])
        .addTo(map)
      markerRefs.current.push(marker)
    }

    return () => {
      for (const marker of markerRefs.current) marker.remove()
      markerRefs.current = []
    }
  }, [map, risks, minSeverity, hidden])

  // One popup at a time, rebuilt whenever the inspected hazard changes.
  useEffect(() => {
    popupRef.current?.remove()
    popupRef.current = null
    if (!map || !active || hidden) return

    // Built from DOM nodes with textContent rather than setHTML: OSM tags are
    // third-party strings, so they must never be parsed as markup.
    const root = document.createElement('div')
    const title = document.createElement('div')
    title.textContent = active.label
    title.style.cssText = 'font-weight:700;font-size:12.5px;margin-bottom:4px'

    const detail = document.createElement('div')
    detail.textContent = active.detail
    detail.style.cssText = 'color:var(--bn-fg-muted);font-size:11px;line-height:1.5'

    const meta = document.createElement('div')
    meta.textContent = `${Math.round(active.offset_m)} m from start · ${Math.round(active.length_m)} m long`
    meta.style.cssText = 'margin-top:6px;font-size:10.5px;color:var(--bn-fg-subtle)'

    root.append(title, detail, meta)

    popupRef.current = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      offset: 16,
      maxWidth: '260px',
    })
      .setLngLat([active.at[1], active.at[0]])
      .setDOMContent(root)
      .addTo(map)

    return () => {
      popupRef.current?.remove()
      popupRef.current = null
    }
  }, [map, active, hidden])

  useEffect(
    () => () => {
      popupRef.current?.remove()
      popupRef.current = null
    },
    [],
  )
}
