import { useState } from 'react'
import { riskText, severityText, useI18n } from '../../lib/i18n'
import type { RiskEvent, RoutePlan } from '../../lib/types'
import { SEVERITY_COLOR, severityRank } from '../../lib/risk'
import { formatDistance } from '../../lib/format'
import { Icon } from '../ui/Icon'
import { EmptyHint, Tooltip } from '../ui/Primitives'

interface Props {
  route: RoutePlan
  onHoverRisk: (coords: [number, number][] | null) => void
  onSelectRisk: (risk: RiskEvent) => void
  activeRiskId: string | null
}

/**
 * Distance-ordered hazard strip: each bar is positioned and sized by the real
 * stretch of route it covers, so the rhythm of a walk is visible at a glance.
 */
export function RiskTimeline({ route, onHoverRisk, onSelectRisk, activeRiskId }: Props) {
  const { t, lang } = useI18n()
  const [hovered, setHovered] = useState<RiskEvent | null>(null)
  const total = Math.max(route.total_distance_m, 1)
  const hazards = route.risks.filter((risk) => severityRank(risk.severity) >= 1)
  const worst = hazards.reduce(
    (acc, risk) => (severityRank(risk.severity) > severityRank(acc) ? risk.severity : acc),
    'none' as RiskEvent['severity'],
  )

  if (!hazards.length) {
    return (
      <EmptyHint icon="shield" title={t('results.noHazardsTitle')}>
        {t('results.noHazardsBody')}
      </EmptyHint>
    )
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-[10.5px] text-subtle">
        <span className="flex items-center gap-1.5">
          <Icon name="warning" size={12} style={{ color: SEVERITY_COLOR[worst] }} />
          {t('results.hazardCount', { n: hazards.length })} · {t('results.worst')}：
          <strong style={{ color: SEVERITY_COLOR[worst] }}>{severityText(lang, worst)}</strong>
        </span>
        <span className="tnum">0 → {formatDistance(total)}</span>
      </div>

      <div
        className="relative h-9 w-full overflow-hidden rounded-chip border border-line"
        style={{ background: 'color-mix(in oklab, var(--bn-line) 55%, transparent)' }}
        onMouseLeave={() => {
          setHovered(null)
          onHoverRisk(null)
        }}
      >
        {hazards.map((risk) => {
          const left = Math.min(99.5, (risk.offset_m / total) * 100)
          const width = Math.max(0.8, Math.min(100 - left, (risk.length_m / total) * 100))
          const active = activeRiskId === risk.id
          const text = riskText(lang, risk.type)
          return (
            <button
              key={risk.id}
              type="button"
              aria-label={`${text.label} ${formatDistance(risk.offset_m)}`}
              onMouseEnter={() => {
                setHovered(risk)
                onHoverRisk([risk.from, risk.to])
              }}
              onFocus={() => {
                setHovered(risk)
                onHoverRisk([risk.from, risk.to])
              }}
              onClick={() => onSelectRisk(risk)}
              className="absolute top-0 h-full transition-all duration-200 hover:brightness-125"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: SEVERITY_COLOR[risk.severity],
                opacity: active || hovered?.id === risk.id ? 1 : 0.72,
                boxShadow: active ? `0 0 0 2px var(--bn-fg) inset` : undefined,
              }}
            />
          )
        })}
      </div>

      <div className="flex flex-wrap gap-1">
        {hazards.slice(0, 8).map((risk) => {
          const text = riskText(lang, risk.type)
          return (
            <Tooltip key={risk.id} label={text.detail}>
              <button
                type="button"
                onClick={() => onSelectRisk(risk)}
                onMouseEnter={() => onHoverRisk([risk.from, risk.to])}
                onMouseLeave={() => onHoverRisk(null)}
                className={[
                  'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors',
                  activeRiskId === risk.id ? 'border-fg text-fg' : 'border-line text-muted hover:text-fg',
                ].join(' ')}
                style={{ color: activeRiskId === risk.id ? undefined : SEVERITY_COLOR[risk.severity] }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: SEVERITY_COLOR[risk.severity] }} />
                {text.label}
                <span className="tnum opacity-70">{formatDistance(risk.offset_m)}</span>
              </button>
            </Tooltip>
          )
        })}
      </div>

      <p className="min-h-[26px] text-[10.5px] leading-snug text-subtle">
        {hovered
          ? `${riskText(lang, hovered.type).label} —— ${riskText(lang, hovered.type).detail}（距起点 ${formatDistance(hovered.offset_m)}）`
          : t('results.hoverBand')}
      </p>
    </div>
  )
}
