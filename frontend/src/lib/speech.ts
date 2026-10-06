import { formatDuration } from './format'
import { profileText, riskText, type Lang } from './i18n'
import type { RoutePlan } from './types'

/**
 * Optional spoken guidance.
 *
 * The UI never talks on its own: a screen-reader user reaches the same content
 * through the DOM, and a sighted user can opt in to a summary. Auto-narration
 * would fight with an active screen reader, so it stays explicit.
 */
export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel()
}

export function speak(text: string, lang: Lang = 'zh', onEnd?: () => void): void {
  if (!speechSupported() || !text.trim()) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang === 'zh' ? 'zh-CN' : 'en-GB'
  utterance.rate = 1.02
  utterance.pitch = 1
  if (onEnd) utterance.onend = () => onEnd()
  window.speechSynthesis.speak(utterance)
}

/** Summary read aloud for a planned route. */
export function buildRouteNarration(route: RoutePlan, lang: Lang = 'zh'): string {
  const name = profileText(lang, route.id).label
  const distance =
    route.total_distance_m < 1000
      ? `${Math.round(route.total_distance_m / 10) * 10} ${lang === 'zh' ? '米' : 'metres'}`
      : `${(route.total_distance_m / 1000).toFixed(1)} ${lang === 'zh' ? '公里' : 'kilometres'}`

  const parts: string[] = []
  parts.push(lang === 'zh' ? `${name}方案。` : `${name} route.`)
  parts.push(
    lang === 'zh'
      ? `全程${distance}，大约需要 ${formatDuration(route.duration_s)}。`
      : `Distance ${distance}, about ${formatDuration(route.duration_s)}.`,
  )
  parts.push(
    lang === 'zh'
      ? `无障碍评分 ${route.score} 分，等级 ${route.grade}。`
      : `Accessibility score ${route.score} out of 100, grade ${route.grade}.`,
  )
  parts.push(
    route.metrics.steps_count === 0
      ? lang === 'zh'
        ? '全程没有台阶。'
        : 'The route is step free.'
      : lang === 'zh'
        ? `沿途有 ${route.metrics.steps_count} 处台阶。`
        : `There are ${route.metrics.steps_count} step sections.`,
  )
  parts.push(
    lang === 'zh'
      ? `盲道覆盖 ${Math.round(route.metrics.tactile_pct)}%，照明覆盖 ${Math.round(route.metrics.lit_pct)}%。`
      : `Tactile paving on ${Math.round(route.metrics.tactile_pct)} percent of the way. Lighting on ${Math.round(route.metrics.lit_pct)} percent.`,
  )

  const hazards = route.risks.filter((risk) => risk.severity !== 'low')
  if (hazards.length === 0) {
    parts.push(lang === 'zh' ? '未检测到明显风险。' : 'No major hazards detected along the route.')
  } else {
    const labels = Array.from(new Set(hazards.map((risk) => riskText(lang, risk.type).label)))
    parts.push(
      lang === 'zh'
        ? `请留意：${labels.join('、')}。`
        : `Watch out for: ${labels.join(', ')}.`,
    )
  }

  return parts.join(lang === 'zh' ? '' : ' ')
}
