import { profileText, summaryText, useI18n } from '../../lib/i18n'
import type { RoutePlan } from '../../lib/types'
import { formatDistance, formatDuration, formatPercent } from '../../lib/format'
import { hazardCount } from '../../lib/risk'
import { Icon } from '../ui/Icon'
import { Badge } from '../ui/Primitives'
import { ScoreRing } from './ScoreRing'

interface Props {
  route: RoutePlan
  selected: boolean
  onSelect: () => void
  badges: string[]
  animate: boolean
  rank: number
}

/** One column of the alternatives comparison. */
export function RouteCard({ route, selected, onSelect, badges, animate, rank }: Props) {
  const { t, lang } = useI18n()
  const hazards = hazardCount(route.risks)
  const serious = hazards.high + hazards.medium
  const text = profileText(lang, route.id)

  const miniBars: { label: string; value: number; color: string }[] = [
    { label: t('metric.tactile'), value: route.metrics.tactile_pct, color: '#22d3a6' },
    { label: t('metric.lighting'), value: route.metrics.lit_pct, color: '#f0b429' },
    { label: t('metric.sidewalk'), value: route.metrics.sidewalk_pct, color: '#4d8dff' },
  ]

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        'anim-rise group relative w-full overflow-hidden rounded-panel border p-3 text-left transition-all duration-300',
        selected
          ? 'border-transparent bg-surface shadow-[var(--bn-shadow-panel)]'
          : 'border-line bg-bg-elev/25 hover:-translate-y-0.5 hover:border-line-strong',
      ].join(' ')}
      style={{
        animationDelay: `${rank * 70}ms`,
        boxShadow: selected ? `0 0 0 1.5px ${route.color}, var(--bn-shadow-panel)` : undefined,
      }}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px] transition-opacity duration-300"
        style={{ background: route.color, opacity: selected ? 1 : 0.35 }}
      />

      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-fg">
              <Icon name={route.icon} size={14} style={{ color: route.color }} />
              {text.label}
            </span>
            {badges.map((badge) => (
              <Badge key={badge} color={route.color} icon="sparkles">
                {badge}
              </Badge>
            ))}
          </div>

          <p className="mt-1 text-[11px] leading-snug text-muted">{summaryText(lang, route, t)}</p>
        </div>

        <ScoreRing score={route.score} grade={route.grade} size={62} thickness={5} animate={animate} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div>
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-subtle">
            {t('metric.distance')}
          </div>
          <div className="tnum text-[13px] font-bold text-fg">{formatDistance(route.total_distance_m)}</div>
        </div>
        <div>
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-subtle">
            {t('metric.time')}
          </div>
          <div className="tnum text-[13px] font-bold text-fg">{formatDuration(route.duration_s)}</div>
        </div>
        <div>
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-subtle">
            {t('metric.steps')}
          </div>
          <div
            className="tnum text-[13px] font-bold"
            style={{ color: route.metrics.steps_count ? '#ff4d5f' : 'var(--bn-ok)' }}
          >
            {route.metrics.steps_count === 0 ? t('metric.stepsNone') : route.metrics.steps_count}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {miniBars.map((bar, index) => (
          <div key={bar.label} className="flex items-center gap-2">
            <span className="w-[52px] shrink-0 text-[10px] text-subtle">{bar.label}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <span
                className="block h-full rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${Math.max(1.5, bar.value)}%`, background: bar.color, transitionDelay: `${index * 60}ms` }}
              />
            </span>
            <span className="tnum w-9 shrink-0 text-right text-[10px] font-semibold text-muted">
              {formatPercent(bar.value)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2 text-[10.5px]">
        <span className="flex items-center gap-1 text-subtle">
          <Icon name="activity" size={11} />
          {route.num_nodes} / {route.explored_count.toLocaleString()}
        </span>
        <span
          className="flex items-center gap-1 font-semibold"
          style={{ color: serious ? '#f0b429' : 'var(--bn-ok)' }}
        >
          <Icon name={serious ? 'warning' : 'shield'} size={11} />
          {serious ? t('results.hazardCount', { n: serious }) : t('results.noHazards')}
        </span>
        {route.also_matches.length ? (
          <span className="text-subtle">
            {t('results.alsoMatches', {
              list: route.also_matches.map((id) => profileText(lang, id).short).join(' / '),
            })}
          </span>
        ) : null}
      </div>

      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-full w-1/2 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `linear-gradient(100deg, transparent, ${route.color}14, transparent)`,
          animation: animate ? 'bn-sweep 1.6s ease-out' : undefined,
        }}
      />
      <span className="sr-only">{selected ? t('results.selectedRoute') : t('results.selectRoute')}</span>
    </button>
  )
}
