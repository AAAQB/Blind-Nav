import { useMemo, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import type { RoutePlan } from '../../lib/types'
import { formatDistance, formatPercent } from '../../lib/format'
import { EmptyHint, MetricRow } from '../ui/Primitives'

interface Props {
  route: RoutePlan
  height?: number
}

const THRESHOLD_PCT = 10

/**
 * Ground-profile chart: incline per metre walked. The 10% line marks the point
 * where a slope becomes a genuine barrier for a blind or wheelchair user.
 */
export function InclineProfile({ route, height = 130 }: Props) {
  const { t } = useI18n()
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const { points, maxPct, total, ticks } = useMemo(() => {
    const segments = route.segments
    let offset = 0
    const raw: { offset: number; pct: number; index: number }[] = []

    for (const segment of segments) {
      raw.push({ offset: offset + segment.length_m / 2, pct: segment.incline_pct, index: segment.index })
      offset += segment.length_m
    }

    const distance = Math.max(offset, 1)
    const peak = Math.max(THRESHOLD_PCT + 2, ...raw.map((item) => item.pct))
    const step = Math.max(1, Math.floor(raw.length / 90))
    const sampled = raw.filter((_, index) => index % step === 0)

    const tickValues: { x: number; label: string }[] = []
    const tickCount = 4
    for (let i = 1; i <= tickCount; i += 1) {
      const value = (distance / tickCount) * i
      tickValues.push({ x: value / distance, label: formatDistance(value) })
    }

    return { points: sampled, maxPct: peak, total: distance, ticks: tickValues }
  }, [route])

  if (!points.length) {
    return (
      <EmptyHint icon="trending" title={t('results.noSlopeData')}>
        {t('results.noSlopeDataBody')}
      </EmptyHint>
    )
  }

  const width = 320
  const padX = 6
  const padY = 10
  const plotW = width - padX * 2
  const plotH = height - padY * 2 - 16

  const xOf = (offset: number) => padX + (offset / total) * plotW
  const yOf = (pct: number) => padY + plotH - (Math.min(pct, maxPct) / maxPct) * plotH

  const line = points.map((point) => `${xOf(point.offset).toFixed(1)},${yOf(point.pct).toFixed(1)}`).join(' ')
  const area = `${padX},${padY + plotH} ${line} ${padX + plotW},${padY + plotH}`
  const hovered = hoverIndex === null ? null : points[hoverIndex]
  const steepShare = route.segments.filter((segment) => segment.incline_pct >= THRESHOLD_PCT).length

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={t('metric.slopeAria', { pct: maxPct.toFixed(0) })}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="bn-incline-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--bn-accent)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--bn-accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((fraction) => (
          <line
            key={fraction}
            x1={padX}
            x2={padX + plotW}
            y1={padY + plotH * fraction}
            y2={padY + plotH * fraction}
            stroke="var(--bn-line)"
            strokeWidth={0.7}
          />
        ))}

        <line
          x1={padX}
          x2={padX + plotW}
          y1={yOf(THRESHOLD_PCT)}
          y2={yOf(THRESHOLD_PCT)}
          stroke="#ff4d5f"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        <text x={padX + 2} y={yOf(THRESHOLD_PCT) - 3} fontSize={8} fill="#ff4d5f" fontWeight={700}>
          {t('metric.barrier', { pct: THRESHOLD_PCT })}
        </text>

        <polygon points={area} fill="url(#bn-incline-fill)" />
        <polyline points={line} fill="none" stroke="var(--bn-accent)" strokeWidth={1.8} strokeLinejoin="round" />

        {steepShare > 0
          ? points
              .filter((point) => point.pct >= THRESHOLD_PCT)
              .map((point) => (
                <circle key={point.index} cx={xOf(point.offset)} cy={yOf(point.pct)} r={2.2} fill="#ff4d5f" />
              ))
          : null}

        {hovered ? (
          <>
            <line
              x1={xOf(hovered.offset)}
              x2={xOf(hovered.offset)}
              y1={padY}
              y2={padY + plotH}
              stroke="var(--bn-fg)"
              strokeWidth={0.8}
              strokeDasharray="2 3"
            />
            <circle cx={xOf(hovered.offset)} cy={yOf(hovered.pct)} r={3.4} fill="var(--bn-fg)" />
          </>
        ) : null}

        {points.map((point, index) => (
          <rect
            key={point.index}
            x={xOf(point.offset) - plotW / points.length / 2}
            y={padY}
            width={Math.max(plotW / points.length, 1)}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHoverIndex(index)}
          />
        ))}

        {ticks.map((tick) => (
          <text
            key={tick.label}
            x={padX + tick.x * plotW}
            y={height - 2}
            fontSize={8}
            fill="var(--bn-fg-subtle)"
            textAnchor="middle"
          >
            {tick.label}
          </text>
        ))}
      </svg>

      <div className="grid grid-cols-3 gap-2">
        <MetricRow
          label={t('metric.meanSlope')}
          value={formatPercent(route.metrics.mean_incline_pct, 1)}
          percent={Math.min(100, route.metrics.mean_incline_pct * 10)}
          color="var(--bn-accent)"
        />
        <MetricRow
          label={t('metric.steepest')}
          value={formatPercent(route.metrics.max_incline_pct, 1)}
          percent={Math.min(100, route.metrics.max_incline_pct * 10)}
          color={route.metrics.max_incline_pct >= THRESHOLD_PCT ? '#ff4d5f' : '#f0b429'}
          delay={60}
        />
        <MetricRow
          label={t('metric.steepStretches')}
          value={`${steepShare} / ${route.segments.length}`}
          percent={(steepShare / Math.max(route.segments.length, 1)) * 100}
          color="#fb923c"
          delay={120}
        />
      </div>

      <p className="text-[10.5px] leading-snug text-subtle">
        {hovered
          ? `${formatPercent(hovered.pct, 1)} · ${formatDistance(hovered.offset)}`
          : t('results.hoverProfile')}
      </p>
    </div>
  )
}
