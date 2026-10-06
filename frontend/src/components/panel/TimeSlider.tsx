import { slotText, useI18n } from '../../lib/i18n'
import type { TimeSlotMeta } from '../../lib/types'
import { formatHour } from '../../lib/format'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/Primitives'

interface Props {
  hour: number
  onChange: (hour: number) => void
  slots: TimeSlotMeta[]
}

const QUICK_HOURS = [6, 9, 13, 18, 21]

function slotFor(hour: number, slots: TimeSlotMeta[]): TimeSlotMeta | null {
  for (const slot of slots) {
    const inRange =
      slot.start_hour <= slot.end_hour
        ? hour >= slot.start_hour && hour < slot.end_hour
        : hour >= slot.start_hour || hour < slot.end_hour
    if (inRange) return slot
  }
  return null
}

/**
 * Departure hour drives the time-dependent cost model: unlit segments are
 * penalised after dark and crowd multipliers change with the time of day.
 */
export function TimeSlider({ hour, onChange, slots }: Props) {
  const { t, lang } = useI18n()
  const slot = slotFor(hour, slots)
  const nowHour = new Date().getHours()
  const fillPercent = (hour / 23) * 100
  const slotLabel = slot ? slotText(lang, slot.name, slot.label) : '—'

  return (
    <div className="space-y-2.5">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="tnum text-2xl font-extrabold leading-none tracking-tight">{formatHour(hour)}</span>
          <span className="flex items-center gap-1 text-[11.5px] font-medium text-accent">
            <Icon name={slot?.icon ?? 'clock'} size={13} />
            {slotLabel}
          </span>
        </div>
        <Tooltip label={`${t('time.now')} · ${formatHour(nowHour)}`}>
          <button
            type="button"
            onClick={() => onChange(nowHour)}
            className="rounded-chip border border-line px-2 py-1 text-[10.5px] font-semibold text-muted transition-colors hover:border-accent hover:text-fg"
          >
            {t('time.now')}
          </button>
        </Tooltip>
      </div>

      <input
        type="range"
        min={0}
        max={23}
        step={1}
        value={hour}
        aria-label={t('time.hourAria')}
        aria-valuetext={`${formatHour(hour)}, ${slotLabel}`}
        onChange={(event) => onChange(Number.parseInt(event.target.value, 10))}
        className="bn-range w-full"
        style={
          {
            background: `linear-gradient(to right, var(--bn-accent) 0%, var(--bn-accent) ${fillPercent}%, var(--bn-line) ${fillPercent}%, var(--bn-line) 100%)`,
          } as React.CSSProperties
        }
      />

      <div className="flex items-center justify-between">
        {QUICK_HOURS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={[
              'tnum rounded-chip px-1.5 py-0.5 text-[10.5px] font-medium transition-colors',
              value === hour ? 'text-accent' : 'text-subtle hover:text-fg',
            ].join(' ')}
          >
            {formatHour(value)}
          </button>
        ))}
      </div>

      {slot ? (
        <div className="flex gap-3 rounded-chip border border-line bg-bg-elev/30 px-2.5 py-2 text-[10.5px] text-muted">
          <span className="flex items-center gap-1">
            <Icon name="sun" size={11} className="text-warn" />
            {t('time.lighting', { v: slot.lighting_multiplier.toFixed(1) })}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="walk" size={11} className="text-accent-2" />
            {t('time.crowd', { v: slot.crowd_multiplier.toFixed(1) })}
          </span>
        </div>
      ) : null}
    </div>
  )
}
