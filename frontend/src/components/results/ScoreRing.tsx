import { useAnimatedValues } from '../../hooks/useAnimatedValues'
import { scoreBandKey, useI18n } from '../../lib/i18n'
import { scoreColor } from '../../lib/risk'
import { Tooltip } from '../ui/Primitives'

interface Props {
  score: number
  grade: string
  size?: number
  thickness?: number
  animate?: boolean
  showBand?: boolean
}

/** Animated accessibility score dial. */
export function ScoreRing({
  score,
  grade,
  size = 76,
  thickness = 6,
  animate = true,
  showBand = false,
}: Props) {
  const [animated] = useAnimatedValues([score], 800, animate)
  const { t } = useI18n()
  const color = scoreColor(score)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.max(0, Math.min(100, animated)) / 100
  const center = size / 2
  const band = t(scoreBandKey(score))

  return (
    <Tooltip label={t('results.scoreTooltip', { score, band })}>
      <div
        className="relative"
        style={{ width: size, height: size }}
        role="img"
        aria-label={t('results.scoreAria', { score, grade })}
      >
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--bn-line)"
            strokeWidth={thickness}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="tnum text-[19px] font-extrabold leading-none" style={{ color }}>
            {Math.round(animated)}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-subtle">
            {showBand ? band : t('results.grade', { grade })}
          </span>
        </div>
      </div>
    </Tooltip>
  )
}
