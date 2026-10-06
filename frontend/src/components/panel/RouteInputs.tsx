import { useEffect, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import type { LatLon } from '../../lib/types'
import { formatCoord } from '../../lib/format'
import { isFiniteLatLon } from '../../lib/geo'
import { Icon } from '../ui/Icon'
import { IconButton, Tooltip } from '../ui/Primitives'

interface Props {
  start: LatLon | null
  end: LatLon | null
  startLabel: string | null
  endLabel: string | null
  picking: 'start' | 'end' | null
  onArmPick: (kind: 'start' | 'end' | null) => void
  onChange: (kind: 'start' | 'end', point: LatLon) => void
  onClear: (kind: 'start' | 'end') => void
  onSwap: () => void
}

const START_COLOR = '#22d3a6'
const END_COLOR = '#ff4d5f'

/** Text field that accepts "lat, lon" and stays in sync with map interaction. */
function CoordField({
  value,
  color,
  label,
  placeholder,
  onCommit,
  invalid,
}: {
  value: string
  color: string
  label: string
  placeholder: string
  onCommit: (text: string) => boolean
  invalid: boolean
}) {
  const [text, setText] = useState(value)

  useEffect(() => setText(value), [value])

  return (
    <input
      value={text}
      aria-label={label}
      placeholder={placeholder}
      inputMode="decimal"
      spellCheck={false}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        if (!onCommit(text)) setText(value)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur()
        }
      }}
      className={[
        'tnum min-w-0 flex-1 rounded-chip border bg-bg-elev/40 px-2.5 py-1.5 font-mono text-[11.5px] outline-none transition-colors',
        invalid
          ? 'border-danger text-danger'
          : 'border-line text-fg focus:border-accent',
      ].join(' ')}
      style={{ borderLeftColor: color, borderLeftWidth: 2 }}
    />
  )
}

function parse(text: string): LatLon | null {
  const parts = text.split(/[,\s]+/).filter(Boolean)
  if (parts.length < 2) return null
  const lat = Number.parseFloat(parts[0])
  const lon = Number.parseFloat(parts[1])
  if (!isFiniteLatLon(lat, lon)) return null
  return { lat, lon }
}

export function RouteInputs({
  start,
  end,
  startLabel,
  endLabel,
  picking,
  onArmPick,
  onChange,
  onClear,
  onSwap,
}: Props) {
  const { t } = useI18n()
  const [invalid, setInvalid] = useState<{ start: boolean; end: boolean }>({ start: false, end: false })

  const commit = (kind: 'start' | 'end') => (text: string) => {
    if (!text.trim()) {
      onClear(kind)
      setInvalid((state) => ({ ...state, [kind]: false }))
      return true
    }
    const point = parse(text)
    if (!point) {
      setInvalid((state) => ({ ...state, [kind]: true }))
      return false
    }
    setInvalid((state) => ({ ...state, [kind]: false }))
    onChange(kind, point)
    return true
  }

  const renderRow = (kind: 'start' | 'end') => {
    const point = kind === 'start' ? start : end
    const label = kind === 'start' ? startLabel : endLabel
    const color = kind === 'start' ? START_COLOR : END_COLOR
    const armed = picking === kind

    return (
      <div key={kind} className="space-y-1">
        <div className="flex items-center gap-2">
          <span
            className="grid h-5 w-5 shrink-0 place-items-center rounded-full border"
            style={{ borderColor: `${color}66`, background: `${color}1f`, color }}
          >
            <Icon name={kind === 'start' ? 'flag' : 'target'} size={11} />
          </span>

          <CoordField
            value={point ? `${formatCoord(point.lat)}, ${formatCoord(point.lon)}` : ''}
            color={color}
            label={kind === 'start' ? t('input.startAria') : t('input.endAria')}
            placeholder={kind === 'start' ? t('input.startPlaceholder') : t('input.endPlaceholder')}
            onCommit={commit(kind)}
            invalid={invalid[kind]}
          />

          <Tooltip label={armed ? t('input.cancelPick') : kind === 'start' ? t('input.pickStart') : t('input.pickEnd')}>
            <button
              type="button"
              onClick={() => onArmPick(armed ? null : kind)}
              aria-pressed={armed}
              aria-label={armed ? t('input.cancelPick') : kind === 'start' ? t('input.pickStart') : t('input.pickEnd')}
              className={[
                'grid h-8 w-8 shrink-0 place-items-center rounded-chip border transition-all duration-200',
                armed ? 'text-bg' : 'border-line text-muted hover:border-line-strong hover:text-fg',
              ].join(' ')}
              style={armed ? { background: color, borderColor: color } : undefined}
            >
              <Icon name={armed ? 'crosshair' : 'pin'} size={15} />
            </button>
          </Tooltip>

          <IconButton
            icon="x"
            label={`${t('input.clear')} ${kind === 'start' ? t('input.start') : t('input.end')}`}
            size={14}
            onClick={() => onClear(kind)}
            className="h-8 w-8"
          />
        </div>

        <p className="pl-7 text-[10.5px] leading-snug text-subtle">
          {label ??
            (point
              ? t('input.resolving')
              : kind === 'start'
                ? t('input.tapMap')
                : t('input.whereHeading'))}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {renderRow('start')}
      <div className="flex items-center gap-2">
        <span className="h-px flex-1 bg-line" />
        <IconButton icon="refresh" label={t('input.swap')} size={13} onClick={onSwap} />
        <span className="h-px flex-1 bg-line" />
      </div>
      {renderRow('end')}
    </div>
  )
}
