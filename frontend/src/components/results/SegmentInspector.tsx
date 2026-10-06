import { factorText, factorValueText, highwayText, profileText, riskText, useI18n } from '../../lib/i18n'
import type { Meta, ProfileId, Segment } from '../../lib/types'
import { formatDistance, formatDuration, formatPercent } from '../../lib/format'
import { SEVERITY_COLOR } from '../../lib/risk'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/Primitives'

interface Props {
  segment: Segment | null
  routeId: ProfileId | null
  routeColor: string
  meta: Meta | null
  onClose: () => void
}

/**
 * Raw OSM attributes for a tapped stretch. This is the "show your working"
 * panel: it explains the accessibility decision with the underlying data.
 */
export function SegmentInspector({ segment, routeId, routeColor, meta, onClose }: Props) {
  const { t, lang } = useI18n()
  if (!segment) return null

  const rows: { label: string; value: string; color?: string; icon: string }[] = [
    { label: t('metric.highway'), value: highwayText(lang, segment.highway), icon: 'road' },
    { label: t('metric.streetName'), value: segment.name ?? t('results.unnamed'), icon: 'pin' },
  ]

  if (meta) {
    for (const factor of meta.segment_factors) {
      if (factor.id === 'risk' || factor.id === 'incline') continue
      const raw =
        factor.id === 'tactile'
          ? segment.tactile_paving
          : factor.id === 'lighting'
            ? segment.lit
            : factor.id === 'sidewalk'
              ? segment.sidewalk
              : segment.surface
      const stop = factor.scale.find((item) => item.value === String(raw).toLowerCase())
      rows.push({
        label: factorText(lang, factor.id).label,
        value: factorValueText(lang, factor.id, String(raw)),
        color: stop?.color,
        icon: factor.icon,
      })
    }
  }

  rows.push({
    label: factorText(lang, 'incline').label,
    value: formatPercent(segment.incline_pct, 1),
    color: segment.incline_pct >= 10 ? '#ff4d5f' : segment.incline_pct >= 5 ? '#f0b429' : '#22d3a6',
    icon: 'trending',
  })

  if (segment.width_m !== null) {
    rows.push({
      label: factorText(lang, 'width').label,
      value: `${segment.width_m.toFixed(1)} m`,
      color: segment.width_m < 1.5 ? '#f0b429' : '#22d3a6',
      icon: 'compress',
    })
  }

  return (
    <div className="anim-rise space-y-2.5 rounded-panel border p-3" style={{ borderColor: routeColor }}>
      <header className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full" style={{ background: routeColor, color: '#04121b' }}>
          <Icon name="crosshair" size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] font-bold text-fg">
            {t('results.segment', { n: segment.index })}
            {routeId ? (
              <span className="ml-1.5 font-medium text-subtle">
                {t('results.segmentOn', { route: profileText(lang, routeId).short })}
              </span>
            ) : null}
          </div>
          <div className="tnum text-[10.5px] text-subtle">
            {t('results.segmentDuration', {
              distance: formatDistance(segment.length_m),
              time: formatDuration(segment.duration_s),
            })}
          </div>
        </div>
        <IconButton icon="x" label={t('results.closeSegment')} size={13} onClick={onClose} />
      </header>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-1.5 text-[10.5px]">
            <Icon name={row.icon} size={11} className="text-subtle" />
            <span className="text-subtle">{row.label}</span>
            <span className="ml-auto truncate font-semibold" style={{ color: row.color ?? 'var(--bn-fg)' }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {segment.risk_reasons.length ? (
        <div className="flex flex-wrap gap-1 border-t border-line pt-2">
          {segment.risk_reasons.map((reason) => (
            <span
              key={reason.code}
              className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
              style={{ color: SEVERITY_COLOR[reason.severity], borderColor: `${SEVERITY_COLOR[reason.severity]}55` }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: SEVERITY_COLOR[reason.severity] }} />
              {riskText(lang, reason.code).label}
            </span>
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-1.5 border-t border-line pt-2 text-[10.5px] text-ok">
          <Icon name="check" size={11} />
          {t('results.noStretchHazard')}
        </p>
      )}
    </div>
  )
}
