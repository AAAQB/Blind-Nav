import { useEffect, useMemo, useState } from 'react'
import { areaText, highwayText, profileText, riskText, severityText, useI18n, type Lang } from '../../lib/i18n'
import type { Coord, Meta, ProfileId, RiskEvent, RoutePlan, Segment } from '../../lib/types'
import { formatDistance, formatDuration, formatPercent } from '../../lib/format'
import { hazardCount, severityRank } from '../../lib/risk'
import type { PlanStatus } from '../../hooks/useRoutes'
import { Icon } from '../ui/Icon'
import { Button, Card, EmptyHint, IconButton, Segmented, Skeleton, Tooltip } from '../ui/Primitives'
import { RouteCard } from './RouteCard'
import { FactorRadar } from './FactorRadar'
import { RiskTimeline } from './RiskTimeline'
import { InclineProfile } from './InclineProfile'
import { DirectionList } from './DirectionList'
import { SegmentInspector } from './SegmentInspector'
import { ScoreRing } from './ScoreRing'

type Tab = 'overview' | 'hazards' | 'directions' | 'slope'

interface Props {
  status: PlanStatus
  routes: RoutePlan[]
  selectedId: ProfileId | null
  onSelectRoute: (id: ProfileId) => void
  highlights: { best_score: ProfileId; fastest: ProfileId; shortest: ProfileId } | null
  meta: Meta | null
  error: string | null
  refreshing: boolean
  onRetry: () => void
  onHoverCoords: (coords: Coord[] | null) => void
  onFocusCoords: (coords: Coord[]) => void
  onSpeakRoute: (route: RoutePlan) => void
  onCopyLink: () => void
  linkCopied: boolean
  activeRisk: RiskEvent | null
  onRiskSelect: (risk: RiskEvent | null) => void
  selectedSegment: { routeId: ProfileId; index: number; segment: Segment } | null
  onCloseSegment: () => void
  animate: boolean
  speechAvailable: boolean
}

export function ResultsPanel({
  status,
  routes,
  selectedId,
  onSelectRoute,
  highlights,
  meta,
  error,
  refreshing,
  onRetry,
  onHoverCoords,
  onFocusCoords,
  onSpeakRoute,
  onCopyLink,
  linkCopied,
  activeRisk,
  onRiskSelect,
  selectedSegment,
  onCloseSegment,
  animate,
  speechAvailable,
}: Props) {
  const { t, lang } = useI18n()
  const [tab, setTab] = useState<Tab>('overview')
  const [activeStep, setActiveStep] = useState<number | null>(null)

  const selected = routes.find((route) => route.id === selectedId) ?? routes[0] ?? null

  useEffect(() => {
    setActiveStep(null)
  }, [selected?.id])

  const badgesFor = useMemo(
    () => (route: RoutePlan): string[] => {
      if (!highlights) return []
      const badges: string[] = []
      if (highlights.best_score === route.id) badges.push(t('badge.bestScore'))
      if (highlights.fastest === route.id && highlights.best_score !== route.id) badges.push(t('badge.fastest'))
      if (
        highlights.shortest === route.id &&
        highlights.fastest !== route.id &&
        highlights.best_score !== route.id
      ) {
        badges.push(t('badge.shortest'))
      }
      return badges
    },
    [highlights, t],
  )

  if (status === 'loading' && !routes.length) {
    return <ResultsSkeleton label={t('skeleton.routes')} />
  }

  if (status === 'error') {
    return (
      <div className="p-3">
        <Card title={t('results.planningFailed')} icon="warning">
          <p className="text-[12px] leading-relaxed text-fg">{error}</p>
          <p className="mt-2 text-[11px] leading-relaxed text-subtle">{t('results.planningFailedBody')}</p>
          <Button variant="outline" icon="refresh" className="mt-3" onClick={onRetry}>
            {t('results.retry')}
          </Button>
        </Card>
      </div>
    )
  }

  if (!selected) {
    return (
      <div className="p-3">
        <Card title={t('section.alternatives')} icon="route">
          <EmptyHint icon="route" title={t('results.noRoute')}>
            {t('results.noRouteBody')}
          </EmptyHint>
        </Card>
      </div>
    )
  }

  const hazards = hazardCount(selected.risks)
  const serious = hazards.high + hazards.medium
  const routeColor = selected.color
  const routeName = profileText(lang, selected.id).label

  const composition: { label: string; value: number; color: string }[] = [
    { label: t('metric.tactilePaving'), value: selected.metrics.tactile_pct, color: '#22d3a6' },
    { label: t('metric.streetLighting'), value: selected.metrics.lit_pct, color: '#f0b429' },
    { label: t('metric.sidewalkPresent'), value: selected.metrics.sidewalk_pct, color: '#4d8dff' },
  ]

  return (
    <div className="flex h-full flex-col gap-2.5 p-3">
      <header className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 text-[13px] font-bold text-fg">
            <Icon name="sliders" size={14} className="text-accent" />
            {routes.length > 1 ? t('results.alternatives', { n: routes.length }) : t('results.alternativesOne')}
            {refreshing ? (
              <span className="ml-1 flex items-center gap-1 text-[10px] font-medium text-accent">
                <Icon name="activity" size={11} />
                {t('results.updating')}
              </span>
            ) : null}
          </h2>
          <p className="text-[10.5px] text-subtle">
            {t('results.subtitle', {
              area: meta ? areaLabel(lang, meta) : '',
              time: formatDuration(selected.duration_s),
            })}
          </p>
        </div>

        {speechAvailable ? (
          <Tooltip label={t('results.readAloud')}>
            <IconButton icon="volume" label={t('results.readAloud')} onClick={() => onSpeakRoute(selected)} />
          </Tooltip>
        ) : null}
        <Tooltip label={linkCopied ? t('results.copied') : t('results.copyLink')}>
          <IconButton
            icon={linkCopied ? 'check' : 'share'}
            label={t('results.copyLink')}
            active={linkCopied}
            onClick={onCopyLink}
          />
        </Tooltip>
      </header>

      {routes.length > 1 ? (
        <div className="flex flex-col gap-2">
          {routes.map((route, index) => (
            <RouteCard
              key={route.id}
              route={route}
              rank={index}
              selected={route.id === selected.id}
              onSelect={() => onSelectRoute(route.id)}
              badges={badgesFor(route)}
              animate={animate}
            />
          ))}
        </div>
      ) : null}

      <section
        className="anim-rise flex items-center gap-3 rounded-panel border px-3 py-2.5"
        style={{ borderColor: `${routeColor}55`, background: `${routeColor}0f` }}
      >
        <ScoreRing score={selected.score} grade={selected.grade} size={72} thickness={6} animate={animate} showBand />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Icon name={selected.icon} size={14} style={{ color: routeColor }} />
            <span className="text-[12.5px] font-bold text-fg">{routeName}</span>
          </div>
          <div className="tnum mt-0.5 text-[11px] text-muted">
            {t('results.statsLine', {
              distance: formatDistance(selected.total_distance_m),
              duration: formatDuration(selected.duration_s),
              steps:
                selected.metrics.steps_count === 0
                  ? t('results.stepFree')
                  : t('results.stepsSections', { n: selected.metrics.steps_count }),
            })}
          </div>
          <div className="tnum mt-0.5 text-[10.5px] text-subtle">
            {t('results.statsLine2', {
              hazards: serious === 0 ? t('results.noHazards') : t('results.hazardCount', { n: serious }),
              tactile: formatPercent(selected.metrics.tactile_pct),
              lit: formatPercent(selected.metrics.lit_pct),
            })}
          </div>
        </div>
      </section>

      <Segmented<Tab>
        ariaLabel={t('results.detailView')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'overview', label: t('results.overview'), icon: 'gauge' },
          { value: 'hazards', label: t('results.hazards'), icon: 'warning' },
          { value: 'directions', label: t('results.steps'), icon: 'routeLine' },
          { value: 'slope', label: t('results.slope'), icon: 'trending' },
        ]}
      />

      <div className="scrollarea -mx-1 flex-1 px-1">
        {tab === 'overview' ? (
          <div className="space-y-2.5">
            <Card title={t('results.profile')} icon="accessibility">
              <FactorRadar factors={selected.factors} color={routeColor} animate={animate} />
            </Card>

            <Card title={t('results.composition')} icon="layers">
              <div className="space-y-2">
                {composition.map((row, index) => (
                  <div key={row.label} className="anim-rise" style={{ animationDelay: `${index * 70}ms` }}>
                    <div className="flex items-baseline justify-between text-[11.5px]">
                      <span className="text-muted">{row.label}</span>
                      <span className="tnum font-semibold text-fg">{formatPercent(row.value)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full transition-[width] duration-700 ease-out"
                        style={{ width: `${Math.max(1.5, row.value)}%`, background: row.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-line pt-2.5 text-[10.5px]">
                <Stat label={t('metric.roughGround')} value={formatDistance(selected.metrics.rough_length_m)} />
                <Stat label={t('metric.stepsLength')} value={formatDistance(selected.metrics.steps_length_m)} />
                <Stat
                  label={t('metric.narrowest')}
                  value={
                    selected.metrics.min_width_m !== null
                      ? `${selected.metrics.min_width_m.toFixed(1)} m`
                      : t('metric.unmapped')
                  }
                />
                <Stat label={t('metric.meanSlope')} value={formatPercent(selected.metrics.mean_incline_pct, 1)} />
                <Stat label={t('metric.nodes')} value={selected.num_nodes} />
                <Stat label={t('metric.explored')} value={selected.explored_count.toLocaleString()} />
              </div>

              {selected.metrics.top_highways.length ? (
                <div className="mt-2.5 flex flex-wrap gap-1 border-t border-line pt-2.5">
                  {selected.metrics.top_highways.map((highway) => (
                    <span
                      key={highway.name}
                      className="rounded-full border border-line px-2 py-0.5 text-[10px] font-medium text-muted"
                    >
                      {highwayText(lang, highway.name)} {highway.pct}%
                    </span>
                  ))}
                </div>
              ) : null}
            </Card>

            <SegmentInspector
              segment={selectedSegment?.segment ?? null}
              routeId={selectedSegment?.routeId ?? null}
              routeColor={routeColor}
              meta={meta}
              onClose={onCloseSegment}
            />
          </div>
        ) : null}

        {tab === 'hazards' ? (
          <div className="space-y-2.5">
            <Card title={t('results.hazardTimeline')} icon="warning">
              <RiskTimeline
                route={selected}
                onHoverRisk={onHoverCoords}
                onSelectRisk={(risk) => onRiskSelect(risk)}
                activeRiskId={activeRisk?.id ?? null}
              />
            </Card>

            {selected.risks.length ? (
              <Card title={t('results.allHazards')} icon="flag">
                <ul className="space-y-1">
                  {selected.risks
                    .slice()
                    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
                    .map((risk) => {
                      const text = riskText(lang, risk.type)
                      return (
                        <li key={risk.id}>
                          <button
                            type="button"
                            onMouseEnter={() => onHoverCoords([risk.from, risk.to])}
                            onMouseLeave={() => onHoverCoords(null)}
                            onClick={() => onRiskSelect(risk)}
                            className={[
                              'flex w-full items-start gap-2 rounded-chip border px-2.5 py-2 text-left transition-colors',
                              activeRisk?.id === risk.id
                                ? 'border-accent bg-accent/10'
                                : 'border-transparent hover:border-line hover:bg-surface',
                            ].join(' ')}
                          >
                            <Icon
                              name={risk.severity === 'high' ? 'warning' : 'info'}
                              size={13}
                              className="mt-0.5"
                              style={{
                                color: risk.severity === 'high' ? 'var(--bn-danger)' : 'var(--bn-warn)',
                              }}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-[11.5px] font-semibold text-fg">
                                {text.label}
                                <span className="tnum ml-1.5 font-normal text-subtle">
                                  {formatDistance(risk.offset_m)} · {formatDistance(risk.length_m)} ·{' '}
                                  {severityText(lang, risk.severity)}
                                </span>
                              </span>
                              <span className="mt-0.5 block text-[10.5px] leading-snug text-subtle">
                                {text.detail}
                              </span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                </ul>
              </Card>
            ) : null}
          </div>
        ) : null}

        {tab === 'directions' ? (
          <Card title={t('results.turnByTurn')} icon="routeLine">
            <DirectionList
              route={selected}
              onHover={onHoverCoords}
              onFocus={onFocusCoords}
              activeIndex={activeStep}
              onActiveIndex={setActiveStep}
            />
          </Card>
        ) : null}

        {tab === 'slope' ? (
          <Card title={t('results.groundProfile')} icon="trending">
            <InclineProfile route={selected} />
          </Card>
        ) : null}
      </div>
    </div>
  )
}

function areaLabel(lang: Lang, meta: Meta): string {
  const id = meta.graph.area ?? meta.default_area
  const found = meta.areas.find((area) => area.id === id)
  return areaText(lang, found?.id ?? id, found?.name ?? id)
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-subtle">{label}</span>
      <span className="tnum truncate font-semibold text-fg">{value}</span>
    </div>
  )
}

function ResultsSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-2.5 p-3" aria-busy aria-label={label}>
      <div className="flex items-center gap-2">
        <Skeleton h={16} w={140} />
        <div className="ml-auto flex gap-1">
          <Skeleton h={28} w={28} />
          <Skeleton h={28} w={28} />
        </div>
      </div>
      {[0, 1, 2].map((index) => (
        <div key={index} className="glass-soft space-y-3 p-3">
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-2">
              <Skeleton h={13} w="55%" />
              <Skeleton h={10} w="85%" />
              <Skeleton h={10} w="70%" />
            </div>
            <Skeleton h={62} w={62} className="rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Skeleton h={26} />
            <Skeleton h={26} />
            <Skeleton h={26} />
          </div>
        </div>
      ))}
    </div>
  )
}
