import { useCallback, useEffect, useMemo, useState } from 'react'
import { errorText, useI18n } from './lib/i18n'
import type { AreaMeta, Coord, LatLon, Place, ProfileId, RiskEvent, Severity } from './lib/types'
import { isFiniteLatLon } from './lib/geo'
import { reverseGeocode } from './lib/api'
import { permalink, readUrlState, writeUrlState } from './lib/urlState'
import { buildRouteNarration, speak, speechSupported, stopSpeaking } from './lib/speech'
import { useTheme } from './lib/theme'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useMeta } from './hooks/useMeta'
import { usePlaces } from './hooks/usePlaces'
import { useRoutes } from './hooks/useRoutes'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { MapView, type FocusRequest, type SegmentHit } from './components/map/MapView'
import { ControlPanel } from './components/panel/ControlPanel'
import { ShortcutsDialog } from './components/panel/ShortcutsDialog'
import { ResultsPanel } from './components/results/ResultsPanel'
import { Icon } from './components/ui/Icon'
import { Segmented } from './components/ui/Primitives'
import { basemapById, defaultBasemapFor, BASEMAPS } from './lib/basemaps'

/** Demo start/end used on first load (Kuala Lumpur city centre). */
const DEFAULT_START: LatLon = { lat: 3.1489, lon: 101.6957 }
const DEFAULT_END: LatLon = { lat: 3.14, lon: 101.7 }
const AREA_OFFSET = 0.006

const FACTOR_ORDER = ['risk', 'tactile', 'lighting', 'sidewalk', 'surface', 'incline', 'route']

export default function App() {
  const { meta, error: metaError } = useMeta()
  const { theme, cycleTheme, toggleBigType, bigType } = useTheme()
  const { t, lang } = useI18n()
  const isDesktop = useMediaQuery('(min-width: 1180px)')

  const initial = useMemo(() => readUrlState(), [])

  const [start, setStart] = useState<LatLon | null>(initial.start ?? DEFAULT_START)
  const [end, setEnd] = useState<LatLon | null>(initial.end ?? DEFAULT_END)
  const [startLabel, setStartLabel] = useState<string | null>(null)
  const [endLabel, setEndLabel] = useState<string | null>(null)
  const [picking, setPicking] = useState<'start' | 'end' | null>(null)
  const [locating, setLocating] = useState(false)

  const [hour, setHour] = useState(() => initial.hour ?? new Date().getHours())
  const [area, setArea] = useState<string | null>(initial.area ?? null)
  const [profiles, setProfiles] = useState<ProfileId[] | null>(initial.profiles ?? null)
  const [dynamicCost, setDynamicCost] = useState(true)
  const [autoPlan, setAutoPlan] = useState(true)

  const [basemapId, setBasemapId] = useState(() => defaultBasemapFor(theme))
  const [basemapTouched, setBasemapTouched] = useState(false)

  const [factorId, setFactorId] = useState(initial.factor ?? 'risk')
  const [selectedRouteId, setSelectedRouteId] = useState<ProfileId | null>(null)
  const [activeRisk, setActiveRisk] = useState<RiskEvent | null>(null)
  const [selectedSegment, setSelectedSegment] = useState<SegmentHit | null>(null)
  const [hoverCoords, setHoverCoords] = useState<Coord[] | null>(null)
  const [focus, setFocus] = useState<FocusRequest | null>(null)
  const [camera, setCamera] = useState<{ lat: number; lon: number; zoom: number } | null>(null)

  const [riskPins, setRiskPins] = useState(true)
  const [riskFloor, setRiskFloor] = useState<Severity>('low')
  const [threeD, setThreeD] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [mobileTab, setMobileTab] = useState<'plan' | 'results'>('plan')

  const search = usePlaces()
  const routesState = useRoutes()
  const routes = routesState.data?.routes ?? []

  // Adopt server defaults once meta arrives.
  useEffect(() => {
    if (!meta) return
    if (!area) setArea(meta.default_area)
    if (!profiles) setProfiles(meta.default_profiles)
  }, [meta, area, profiles])

  // Keep the document title and language in step with the interface language.
  useEffect(() => {
    document.title = t('app.docTitle')
  }, [t, lang])

  // Keep the basemap aligned with the theme until the user overrides it.
  useEffect(() => {
    if (!basemapTouched) setBasemapId(defaultBasemapFor(theme))
  }, [theme, basemapTouched])

  const activeProfiles = profiles ?? meta?.default_profiles ?? ['accessible', 'fast', 'lit']

  const planNow = useCallback(() => {
    if (!start || !end) return
    if (!isFiniteLatLon(start.lat, start.lon) || !isFiniteLatLon(end.lat, end.lon)) return
    if (start.lat === end.lat && start.lon === end.lon) return
    routesState.plan({
      start,
      end,
      hour,
      area: area ?? 'kl',
      profiles: activeProfiles,
      useDynamicCost: dynamicCost,
    })
  }, [start, end, hour, area, activeProfiles, dynamicCost, routesState])

  // Auto-planning: debounced so dragging a marker does not spam the backend.
  const autoKey = useDebouncedValue(
    JSON.stringify({ start, end, hour, area, profiles: activeProfiles, dynamicCost }),
    600,
  )

  useEffect(() => {
    if (!autoPlan) return
    const parsed = JSON.parse(autoKey) as { start: LatLon | null; end: LatLon | null }
    if (!parsed.start || !parsed.end) return
    planNow()
    // planNow is intentionally omitted: autoKey already encodes its inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoKey, autoPlan])

  // Pick the best alternative whenever a new result set lands.
  useEffect(() => {
    if (!routesState.data) return
    const ids = routesState.data.routes.map((route) => route.id)
    setSelectedRouteId((current) => (current && ids.includes(current) ? current : routesState.data!.highlights.best_score ?? ids[0] ?? null))
    setActiveRisk(null)
    setSelectedSegment(null)
    setHoverCoords(null)
  }, [routesState.data])

  // Shareable URL state.
  useEffect(() => {
    writeUrlState({
      start: start ?? undefined,
      end: end ?? undefined,
      hour,
      area: area ?? undefined,
      profiles: activeProfiles,
      factor: factorId,
    })
  }, [start, end, hour, area, activeProfiles, factorId])

  // Reverse geocode the endpoints so the inputs read like places, not numbers.
  const startKey = start ? `${start.lat.toFixed(5)},${start.lon.toFixed(5)}` : ''
  const endKey = end ? `${end.lat.toFixed(5)},${end.lon.toFixed(5)}` : ''
  const debouncedStartKey = useDebouncedValue(startKey, 700)
  const debouncedEndKey = useDebouncedValue(endKey, 700)

  useEffect(() => {
    if (!debouncedStartKey) {
      setStartLabel(null)
      return
    }
    const controller = new AbortController()
    const [lat, lon] = debouncedStartKey.split(',').map(Number)
    reverseGeocode(lat, lon, controller.signal)
      .then((place) => setStartLabel(place.name || place.label.split(',')[0] || 'Dropped pin'))
      .catch(() => setStartLabel('Dropped pin'))
    return () => controller.abort()
  }, [debouncedStartKey])

  useEffect(() => {
    if (!debouncedEndKey) {
      setEndLabel(null)
      return
    }
    const controller = new AbortController()
    const [lat, lon] = debouncedEndKey.split(',').map(Number)
    reverseGeocode(lat, lon, controller.signal)
      .then((place) => setEndLabel(place.name || place.label.split(',')[0] || 'Dropped pin'))
      .catch(() => setEndLabel('Dropped pin'))
    return () => controller.abort()
  }, [debouncedEndKey])

  const selectedRoute = routes.find((route) => route.id === selectedRouteId) ?? routes[0] ?? null

  /* ── Interaction handlers ── */

  const handleMapPick = useCallback(
    (point: LatLon) => {
      if (picking === 'start') {
        setStart(point)
        setPicking(null)
      } else if (picking === 'end') {
        setEnd(point)
        setPicking(null)
      }
    },
    [picking],
  )

  const handleMarkerDrag = useCallback((kind: 'start' | 'end', point: LatLon) => {
    if (kind === 'start') setStart(point)
    else setEnd(point)
  }, [])

  const handleSelectPlace = useCallback(
    (place: Place) => {
      const point = { lat: Number(place.lat.toFixed(6)), lon: Number(place.lon.toFixed(6)) }
      // Fill whichever endpoint is missing, otherwise move the destination.
      if (!start) {
        setStart(point)
        setStartLabel(place.name || place.label.split(',')[0])
      } else {
        setEnd(point)
        setEndLabel(place.name || place.label.split(',')[0])
      }
      if (place.bbox) {
        setFocus({
          coords: [
            [place.bbox.south, place.bbox.west],
            [place.bbox.north, place.bbox.east],
          ],
          key: Date.now(),
          padding: 120,
        })
      } else {
        setCamera({ ...point, zoom: 16 })
      }
      search.clear()
    },
    [start, search],
  )

  const handleUseMyLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStartLabel(t('search.unavailable'))
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStart({
          lat: Number(position.coords.latitude.toFixed(6)),
          lon: Number(position.coords.longitude.toFixed(6)),
        })
        setCamera({ lat: position.coords.latitude, lon: position.coords.longitude, zoom: 16 })
        setLocating(false)
      },
      () => {
        setStartLabel(t('search.denied'))
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }, [t])

  const handleJumpArea = useCallback((target: AreaMeta) => {
    const nextStart = { lat: target.lat, lon: target.lon }
    setStart(nextStart)
    setEnd({ lat: target.lat + AREA_OFFSET, lon: target.lon + AREA_OFFSET })
    setArea(target.id)
    setCamera({ lat: target.lat, lon: target.lon, zoom: target.zoom })
    setActiveRisk(null)
    setSelectedSegment(null)
  }, [])

  const handleSwap = useCallback(() => {
    setStart(end)
    setEnd(start)
    setStartLabel(endLabel)
    setEndLabel(startLabel)
  }, [end, start, endLabel, startLabel])

  const handleClearPoint = useCallback((kind: 'start' | 'end') => {
    if (kind === 'start') {
      setStart(null)
      setStartLabel(null)
    } else {
      setEnd(null)
      setEndLabel(null)
    }
  }, [])

  const handleToggleProfile = useCallback(
    (id: ProfileId) => {
      setProfiles((current) => {
        const list = current ?? activeProfiles
        if (list.includes(id)) {
          return list.length > 1 ? list.filter((item) => item !== id) : list
        }
        const max = meta?.max_profiles ?? 4
        return list.length >= max ? list : [...list, id]
      })
    },
    [activeProfiles, meta],
  )

  const handleReset = useCallback(() => {
    stopSpeaking()
    setStart(DEFAULT_START)
    setEnd(DEFAULT_END)
    setActiveRisk(null)
    setSelectedSegment(null)
    setHoverCoords(null)
    routesState.clear()
  }, [routesState])

  const handleCopyLink = useCallback(() => {
    const url = permalink({
      start: start ?? undefined,
      end: end ?? undefined,
      hour,
      area: area ?? undefined,
      profiles: activeProfiles,
      factor: factorId,
    })
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setLinkCopied(true)
        window.setTimeout(() => setLinkCopied(false), 2000)
      })
      .catch(() => setLinkCopied(false))
  }, [start, end, hour, area, activeProfiles, factorId])

  const handleSpeakRoute = useCallback(
    (route: (typeof routes)[number]) => {
      speak(buildRouteNarration(route, lang), lang)
    },
    [lang],
  )

  const handleSegmentPick = useCallback((hit: SegmentHit | null) => {
    setSelectedSegment(hit)
    if (hit) {
      setActiveRisk(null)
      setHoverCoords(null)
    }
  }, [])

  const cycleFactor = useCallback(() => {
    setFactorId((current) => FACTOR_ORDER[(FACTOR_ORDER.indexOf(current) + 1) % FACTOR_ORDER.length] ?? 'risk')
  }, [])

  const cycleBasemap = useCallback(() => {
    setBasemapTouched(true)
    setBasemapId((current) => {
      const index = BASEMAPS.findIndex((item) => item.id === current)
      return BASEMAPS[(index + 1) % BASEMAPS.length].id
    })
  }, [])

  /* ── Keyboard shortcuts ── */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)

      if (event.key === 'Escape') {
        if (shortcutsOpen) setShortcutsOpen(false)
        else if (picking) setPicking(null)
        else if (sheetOpen) setSheetOpen(false)
        return
      }

      if (typing) return
      if (event.metaKey || event.ctrlKey || event.altKey) return

      switch (event.key) {
        case 's':
        case 'S':
          setPicking((current) => (current === 'start' ? null : 'start'))
          break
        case 'e':
        case 'E':
          setPicking((current) => (current === 'end' ? null : 'end'))
          break
        case 'Enter':
          planNow()
          break
        case '1':
        case '2':
        case '3':
        case '4': {
          const index = Number.parseInt(event.key, 10) - 1
          const route = routes[index]
          if (route) setSelectedRouteId(route.id)
          break
        }
        case 'c':
        case 'C':
          cycleFactor()
          break
        case 't':
        case 'T':
          cycleTheme()
          break
        case 'b':
        case 'B':
          cycleBasemap()
          break
        case 'l':
        case 'L':
          toggleBigType()
          break
        case 'd':
        case 'D':
          setThreeD((value) => !value)
          break
        case 'v':
        case 'V':
          if (selectedRoute && speechSupported()) speak(buildRouteNarration(selectedRoute, lang), lang)
          break
        case '?':
          setShortcutsOpen(true)
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    cycleBasemap,
    cycleFactor,
    cycleTheme,
    lang,
    picking,
    planNow,
    routes,
    selectedRoute,
    sheetOpen,
    shortcutsOpen,
    toggleBigType,
  ])

  const fitPadding = useMemo(() => {
    if (isDesktop) return { top: 96, right: 448, bottom: 128, left: 404 }
    return { top: 84, right: 44, bottom: sheetOpen ? 360 : 190, left: 44 }
  }, [isDesktop, sheetOpen])

  /**
   * Space the panels and the mobile sheet leave for floating map chrome, so the
   * basemap/3D controls and the legend never end up underneath a panel.
   * Desktop panels: 16px margin + 356/404px width. Mobile sheet: 62px collapsed.
   */
  const chrome = useMemo(
    () => (isDesktop ? { left: 372, right: 420, bottom: 16 } : { left: 16, right: 16, bottom: 74 }),
    [isDesktop],
  )

  const focusCoords = useCallback((coords: Coord[]) => {
    setFocus({ coords, key: Date.now(), padding: 160 })
  }, [])

  const handleRiskSelect = useCallback(
    (risk: RiskEvent | null) => {
      setActiveRisk(risk)
      if (risk) setSelectedSegment(null)
    },
    [],
  )

  const panelShared = {
    meta,
    loadedArea: routesState.data?.graph.area ?? meta?.graph.area ?? null,
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-bg">
      <MapView
        meta={meta}
        routes={routes}
        selectedId={selectedRoute?.id ?? null}
        onSelectRoute={setSelectedRouteId}
        factorId={factorId}
        onFactorChange={setFactorId}
        start={start}
        end={end}
        picking={picking}
        onMapPick={handleMapPick}
        onMarkerDrag={handleMarkerDrag}
        camera={camera}
        focus={focus}
        hoverCoords={hoverCoords}
        activeRisk={activeRisk}
        onRiskSelect={handleRiskSelect}
        showRiskPins={riskPins}
        riskFloor={riskFloor}
        onSegmentPick={handleSegmentPick}
        fitPadding={fitPadding}
        basemapId={basemapId}
        onBasemapChange={(id) => {
          setBasemapTouched(true)
          setBasemapId(id)
        }}
        threeD={threeD}
        onThreeDChange={setThreeD}
        chrome={chrome}
      />

      {metaError ? (
        <div className="anim-rise absolute left-1/2 top-4 z-40 -translate-x-1/2">
          <div className="glass flex max-w-[46ch] items-start gap-2 border-danger/60 px-3.5 py-2.5 text-[11.5px]">
            <Icon name="warning" size={14} className="mt-0.5 text-danger" />
            <span>
              <strong className="font-semibold">{t('error.backendTitle')}</strong> {metaError}
            </span>
          </div>
        </div>
      ) : null}

      {isDesktop ? (
        <>
          <aside className="glass anim-rise absolute bottom-4 left-4 top-4 z-30 flex w-[356px] flex-col overflow-hidden">
            <ControlPanel
              {...panelShared}
              start={start}
              end={end}
              startLabel={startLabel}
              endLabel={endLabel}
              picking={picking}
              onArmPick={setPicking}
              onCoordChange={(kind, point) => (kind === 'start' ? setStart(point) : setEnd(point))}
              onClearPoint={handleClearPoint}
              onSwap={handleSwap}
              search={search}
              onSelectPlace={handleSelectPlace}
              onUseMyLocation={handleUseMyLocation}
              locating={locating}
              activeArea={area}
              onJumpArea={handleJumpArea}
              profiles={activeProfiles}
              onToggleProfile={handleToggleProfile}
              hour={hour}
              onHourChange={setHour}
              autoPlan={autoPlan}
              onToggleAutoPlan={setAutoPlan}
              dynamicCost={dynamicCost}
              onToggleDynamicCost={setDynamicCost}
              riskPins={riskPins}
              onToggleRiskPins={setRiskPins}
              riskFloor={riskFloor}
              onRiskFloorChange={setRiskFloor}
              planning={routesState.status === 'loading' && !routes.length}
              refreshing={routesState.refreshing}
              hasRoutes={routes.length > 0}
              onPlan={planNow}
              onReset={handleReset}
              onShowShortcuts={() => setShortcutsOpen(true)}
            />
          </aside>

          <aside className="glass anim-rise absolute bottom-4 right-4 top-4 z-30 flex w-[404px] flex-col overflow-hidden">
            <ResultsPanel
              status={routesState.status}
              routes={routes}
              selectedId={selectedRoute?.id ?? null}
              onSelectRoute={setSelectedRouteId}
              highlights={routesState.data?.highlights ?? null}
              meta={meta}
              error={errorText(lang, routesState.errorCode, routesState.error ?? t('error.planFailed'))}
              refreshing={routesState.refreshing}
              onRetry={planNow}
              onHoverCoords={setHoverCoords}
              onFocusCoords={focusCoords}
              onSpeakRoute={handleSpeakRoute}
              onCopyLink={handleCopyLink}
              linkCopied={linkCopied}
              activeRisk={activeRisk}
              onRiskSelect={handleRiskSelect}
              selectedSegment={selectedSegment}
              onCloseSegment={() => setSelectedSegment(null)}
              animate
              speechAvailable={speechSupported()}
            />
          </aside>
        </>
      ) : (
        <div
          className="glass anim-rise absolute inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-b-none"
          style={{ maxHeight: sheetOpen ? '78vh' : 62 }}
        >
          <div className="flex items-center gap-2 px-3 py-2">
            <button
              type="button"
              onClick={() => setSheetOpen((value) => !value)}
              aria-expanded={sheetOpen}
              className="flex flex-1 items-center gap-2 text-left"
            >
              <span className="h-1 w-10 rounded-full bg-line-strong" />
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                {sheetOpen ? t('sheet.hide') : t('sheet.show')}
              </span>
              <Icon
                name="chevron-up"
                size={14}
                className={['ml-auto text-subtle transition-transform duration-300', sheetOpen ? 'rotate-180' : ''].join(' ')}
              />
            </button>
            <span className="hidden text-[10.5px] text-subtle sm:block">
              {routes.length ? t('results.alternatives', { n: routes.length }) : ''}
            </span>
          </div>

          {sheetOpen ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="px-3 pb-2">
                <Segmented<'plan' | 'results'>
                  ariaLabel={t('results.detailView')}
                  value={mobileTab}
                  onChange={setMobileTab}
                  options={[
                    { value: 'plan', label: t('sheet.plan'), icon: 'sliders' },
                    { value: 'results', label: t('sheet.results'), icon: 'gauge' },
                  ]}
                />
              </div>

              <div className="scrollarea min-h-0 flex-1">
                {mobileTab === 'plan' ? (
                  <div className="px-3 pb-3">
                    <ControlPanel
                      {...panelShared}
                      start={start}
                      end={end}
                      startLabel={startLabel}
                      endLabel={endLabel}
                      picking={picking}
                      onArmPick={(kind) => {
                        setPicking(kind)
                        setSheetOpen(false)
                      }}
                      onCoordChange={(kind, point) => (kind === 'start' ? setStart(point) : setEnd(point))}
                      onClearPoint={handleClearPoint}
                      onSwap={handleSwap}
                      search={search}
                      onSelectPlace={handleSelectPlace}
                      onUseMyLocation={handleUseMyLocation}
                      locating={locating}
                      activeArea={area}
                      onJumpArea={handleJumpArea}
                      profiles={activeProfiles}
                      onToggleProfile={handleToggleProfile}
                      hour={hour}
                      onHourChange={setHour}
                      autoPlan={autoPlan}
                      onToggleAutoPlan={setAutoPlan}
                      dynamicCost={dynamicCost}
                      onToggleDynamicCost={setDynamicCost}
                      riskPins={riskPins}
                      onToggleRiskPins={setRiskPins}
                      riskFloor={riskFloor}
                      onRiskFloorChange={setRiskFloor}
                      planning={routesState.status === 'loading' && !routes.length}
                      refreshing={routesState.refreshing}
                      hasRoutes={routes.length > 0}
                      onPlan={planNow}
                      onReset={handleReset}
                      onShowShortcuts={() => setShortcutsOpen(true)}
                    />
                  </div>
                ) : (
                  <ResultsPanel
                    status={routesState.status}
                    routes={routes}
                    selectedId={selectedRoute?.id ?? null}
                    onSelectRoute={setSelectedRouteId}
                    highlights={routesState.data?.highlights ?? null}
                    meta={meta}
                    error={errorText(lang, routesState.errorCode, routesState.error ?? t('error.planFailed'))}
                    refreshing={routesState.refreshing}
                    onRetry={planNow}
                    onHoverCoords={setHoverCoords}
                    onFocusCoords={focusCoords}
                    onSpeakRoute={handleSpeakRoute}
                    onCopyLink={handleCopyLink}
                    linkCopied={linkCopied}
                    activeRisk={activeRisk}
                    onRiskSelect={handleRiskSelect}
                    selectedSegment={selectedSegment}
                    onCloseSegment={() => setSelectedSegment(null)}
                    animate
                    speechAvailable={speechSupported()}
                  />
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {linkCopied ? (
        <div className="anim-rise pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="glass flex items-center gap-2 px-3.5 py-2 text-[11.5px] font-semibold text-ok">
            <Icon name="check" size={13} />
            {t('results.copiedToast')}
          </div>
        </div>
      ) : null}

      {bigType ? (
        <div className="pointer-events-none absolute z-10 hidden md:block" style={{ left: chrome.left + 12, top: 56 }}>
          <span className="glass-soft px-2.5 py-1.5 text-[10.5px] font-semibold text-accent">
            {t('toolbar.basemapNow', { name: t(basemapById(basemapId).labelKey) })}
          </span>
        </div>
      ) : null}

      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  )
}
