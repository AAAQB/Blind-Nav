import type { RiskEvent, Severity, Segment } from './types'

export const SEVERITY_ORDER: Severity[] = ['none', 'low', 'medium', 'high']

export function severityRank(severity: Severity): number {
  return SEVERITY_ORDER.indexOf(severity)
}

/** Rank colours are theme-independent: hazard meaning must not shift. */
export const SEVERITY_COLOR: Record<Severity, string> = {
  high: '#ff4d5f',
  medium: '#f0b429',
  low: '#4d8dff',
  none: '#22d3a6',
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  high: 'High risk',
  medium: 'Caution',
  low: 'Minor',
  none: 'Clear',
}

export function isHazard(severity: Severity): boolean {
  return severity === 'high' || severity === 'medium'
}

/** Score bands drive the ring colour and the grade chip. */
export function scoreColor(score: number): string {
  if (score >= 85) return '#22d3a6'
  if (score >= 70) return '#7bd88f'
  if (score >= 55) return '#f0b429'
  if (score >= 40) return '#fb923c'
  return '#ff4d5f'
}

export function scoreBand(score: number): string {
  if (score >= 85) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 55) return 'Fair'
  if (score >= 40) return 'Poor'
  return 'Avoid'
}

export interface RiskCluster {
  type: string
  severity: Severity
  events: RiskEvent[]
  length_m: number
  first_offset_m: number
}

/** Group consecutive events of the same hazard type into a single timeline row. */
export function clusterRisks(events: RiskEvent[]): RiskCluster[] {
  const clusters: RiskCluster[] = []
  for (const event of events) {
    const last = clusters[clusters.length - 1]
    if (last && last.type === event.type) {
      last.events.push(event)
      last.length_m += event.length_m
      if (severityRank(event.severity) > severityRank(last.severity)) {
        last.severity = event.severity
      }
      continue
    }
    clusters.push({
      type: event.type,
      severity: event.severity,
      events: [event],
      length_m: event.length_m,
      first_offset_m: event.offset_m,
    })
  }
  return clusters
}

export function hazardCount(events: RiskEvent[]): { high: number; medium: number; low: number } {
  return events.reduce(
    (acc, event) => {
      acc[event.severity as 'high' | 'medium' | 'low'] += 1
      return acc
    },
    { high: 0, medium: 0, low: 0 },
  )
}

/** Colour a segment for one of the meta segment factors. */
export function segmentColor(
  segment: Segment,
  factorId: string,
  scale: { value: string; color: string }[],
): string {
  const palette = new Map(scale.map((stop) => [stop.value, stop.color]))

  if (factorId === 'risk') return SEVERITY_COLOR[segment.risk]

  if (factorId === 'incline') {
    const value = segment.incline_pct
    if (value >= 10) return palette.get('10+') ?? '#ff4d5f'
    if (value >= 5) return palette.get('5-10') ?? '#f0b429'
    if (value >= 2) return palette.get('2-5') ?? '#a3e635'
    return palette.get('0-2') ?? '#22d3a6'
  }

  const raw =
    factorId === 'tactile'
      ? segment.tactile_paving
      : factorId === 'lighting'
        ? segment.lit
        : factorId === 'sidewalk'
          ? segment.sidewalk
          : segment.surface

  return palette.get(String(raw).toLowerCase()) ?? palette.get('unknown') ?? '#6b7280'
}
