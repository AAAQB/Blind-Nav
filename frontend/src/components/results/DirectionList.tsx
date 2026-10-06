import { useMemo } from 'react'
import { cardinalText, directionText, useI18n } from '../../lib/i18n'
import type { Coord, RoutePlan } from '../../lib/types'
import { bearing } from '../../lib/geo'
import { formatDistance } from '../../lib/format'
import { Icon } from '../ui/Icon'
import { EmptyHint } from '../ui/Primitives'

interface Props {
  route: RoutePlan
  onHover: (coords: Coord[] | null) => void
  onFocus: (coords: Coord[]) => void
  activeIndex: number | null
  onActiveIndex: (index: number | null) => void
}

const ICON_FOR: Record<string, string> = {
  start: 'start',
  straight: 'straight',
  'slight-left': 'slight-left',
  'slight-right': 'slight-right',
  left: 'turn-left',
  right: 'turn-right',
  uturn: 'uturn',
  destination: 'destination',
}

const TONE_FOR: Record<string, string> = {
  start: 'var(--bn-ok)',
  destination: 'var(--bn-danger)',
  left: 'var(--bn-accent-2)',
  right: 'var(--bn-accent-2)',
  'slight-left': 'var(--bn-accent-3)',
  'slight-right': 'var(--bn-accent-3)',
  uturn: 'var(--bn-warn)',
  straight: 'var(--bn-fg-muted)',
}

/** Cut a path between two distances along it. */
function sliceByDistance(coords: Coord[], cumulative: number[], from: number, to: number): Coord[] {
  const out: Coord[] = []
  for (let i = 0; i < coords.length; i += 1) {
    if (cumulative[i] >= from && cumulative[i] <= to) out.push(coords[i])
  }
  if (!out.length) return coords.slice(0, 2)

  // Add interpolated endpoints so short steps still render.
  const first = out[0]
  const last = out[out.length - 1]
  if (first === last && coords.length > 1) {
    const index = coords.indexOf(first)
    const next = coords[Math.min(index + 1, coords.length - 1)]
    if (next !== first) out.push(next)
  }
  return out
}

/**
 * Turn-by-turn list. Hovering or focusing a row highlights exactly the stretch
 * it describes, which is how the instruction list and the map stay in sync.
 */
export function DirectionList({ route, onHover, onFocus, activeIndex, onActiveIndex }: Props) {
  const { t, lang } = useI18n()

  const steps = useMemo(() => {
    const coords = route.path
    const cumulative: number[] = [0]
    for (let i = 1; i < coords.length; i += 1) {
      const d = Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1])
      cumulative.push(cumulative[i - 1] + d)
    }
    const span = cumulative[cumulative.length - 1] || 1
    const scale = route.total_distance_m / span

    let travelled = 0
    const scaled = cumulative.map((value) => value * scale)
    return route.directions.map((direction, index) => {
      const from = travelled
      travelled += direction.distance_m
      const slice = sliceByDistance(coords, scaled, from, Math.max(travelled, from + 1))
      // Initial heading: read it a few nodes in, so a bend later in the move
      // does not distort the "head north-east" wording.
      const headingTo = slice.length > 3 ? slice[3] : slice[slice.length - 1]
      const heading = slice.length > 1 ? bearing(slice[0] as Coord, headingTo as Coord) : 0
      return { direction, coords: slice, cardinal: cardinalText(lang, heading), index }
    })
  }, [route, lang])

  if (!steps.length) {
    return (
      <EmptyHint icon="routeLine" title={t('results.noDirections')}>
        {t('results.noDirectionsBody')}
      </EmptyHint>
    )
  }

  return (
    <ol className="space-y-1">
      {steps.map((step, index) => {
        const { direction, coords, cardinal } = step
        const active = index === activeIndex
        const tone = TONE_FOR[direction.icon] ?? 'var(--bn-fg-muted)'
        const label = directionText(lang, direction, direction.street, cardinal)
        return (
          <li key={`${direction.instruction}-${index}`}>
            <button
              type="button"
              onMouseEnter={() => {
                onActiveIndex(index)
                onHover(coords)
              }}
              onMouseLeave={() => {
                onActiveIndex(null)
                onHover(null)
              }}
              onFocus={() => {
                onActiveIndex(index)
                onHover(coords)
              }}
              onBlur={() => {
                onActiveIndex(null)
                onHover(null)
              }}
              onClick={() => onFocus(coords)}
              aria-label={`${t('dir.stepAria', { n: index + 1 })}：${label}`}
              className={[
                'group flex w-full items-center gap-2.5 rounded-chip border px-2.5 py-2 text-left transition-all duration-200',
                active
                  ? 'border-accent/60 bg-accent/10'
                  : 'border-transparent hover:border-line hover:bg-surface',
              ].join(' ')}
            >
              <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full border"
                style={{ borderColor: `${tone}`, color: tone, background: 'color-mix(in oklab, currentColor 12%, transparent)' }}
              >
                <Icon name={ICON_FOR[direction.icon] ?? 'straight'} size={15} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold text-fg">{label}</span>
                <span className="mt-0.5 flex items-center gap-2 text-[10.5px] text-subtle">
                  <span className="tnum">{formatDistance(direction.distance_m)}</span>
                  {direction.angle !== null ? (
                    <span className="tnum opacity-80">{Math.abs(Math.round(direction.angle))}°</span>
                  ) : null}
                </span>
              </span>

              <span className="tnum shrink-0 text-[10px] font-bold text-subtle opacity-0 transition-opacity group-hover:opacity-100">
                #{index + 1}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
