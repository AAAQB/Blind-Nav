import { useState } from 'react'
import { useAnimatedValues } from '../../hooks/useAnimatedValues'
import { axisLabel, factorText, useI18n } from '../../lib/i18n'
import type { RouteFactors } from '../../lib/types'

interface Props {
  factors: RouteFactors
  color: string
  size?: number
  animate?: boolean
}

const AXES: (keyof RouteFactors)[] = ['tactile', 'lighting', 'sidewalk', 'surface', 'incline', 'width']

/**
 * Six-axis accessibility profile. Hand-drawn SVG keeps it dependency-free and
 * lets the polygon morph smoothly when a different alternative is selected.
 */
export function FactorRadar({ factors, color, size = 168, animate = true }: Props) {
  const { t, lang } = useI18n()
  const targets = AXES.map((axis) => factors[axis] ?? 0)
  const values = useAnimatedValues(targets, 700, animate)
  const [hovered, setHovered] = useState<number | null>(null)

  const center = size / 2
  const radius = center - 26

  const point = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / AXES.length - Math.PI / 2
    const r = (Math.max(0, Math.min(100, value)) / 100) * radius
    return [center + Math.cos(angle) * r, center + Math.sin(angle) * r] as const
  }

  const polygon = values.map((value, index) => point(index, value).join(',')).join(' ')
  const gridRings = [25, 50, 75, 100]

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} role="img" aria-label={t('metric.factorAria')}>
        {gridRings.map((ring) => (
          <polygon
            key={ring}
            points={AXES.map((_, index) => point(index, ring).join(',')).join(' ')}
            fill="none"
            stroke="var(--bn-line)"
            strokeWidth={ring === 100 ? 1.2 : 0.7}
            strokeDasharray={ring === 100 ? undefined : '3 4'}
          />
        ))}

        {AXES.map((axis, index) => {
          const [x, y] = point(index, 100)
          return <line key={axis} x1={center} y1={center} x2={x} y2={y} stroke="var(--bn-line)" strokeWidth={0.7} />
        })}

        <polygon
          points={polygon}
          fill={color}
          fillOpacity={0.22}
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 8px ${color}55)` }}
        />

        {values.map((value, index) => {
          const [x, y] = point(index, value)
          return <circle key={AXES[index]} cx={x} cy={y} r={hovered === index ? 4.5 : 3} fill={color} />
        })}

        {AXES.map((axis, index) => {
          const angle = (Math.PI * 2 * index) / AXES.length - Math.PI / 2
          const lx = center + Math.cos(angle) * (radius + 15)
          const ly = center + Math.sin(angle) * (radius + 15)
          return (
            <text
              key={axis}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9.5}
              fontWeight={600}
              fill={hovered === index ? color : 'var(--bn-fg-muted)'}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'default' }}
            >
              {axisLabel(lang, axis)}
            </text>
          )
        })}
      </svg>

      <p className="h-8 max-w-[30ch] text-center text-[10.5px] leading-snug text-subtle">
        {hovered === null
          ? t('results.hoverAxis')
          : `${axisLabel(lang, AXES[hovered])}：${Math.round(targets[hovered])}/100 —— ${factorText(lang, AXES[hovered]).description}`}
      </p>
    </div>
  )
}
