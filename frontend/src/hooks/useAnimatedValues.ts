import { useEffect, useRef, useState } from 'react'

/**
 * Interpolates a numeric vector towards its target with an ease-out curve.
 * Used by the SVG charts so a route change animates instead of snapping.
 */
export function useAnimatedValues(target: number[], durationMs = 620, enabled = true): number[] {
  const [values, setValues] = useState<number[]>(target)
  const fromRef = useRef<number[]>(target)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) {
      setValues(target)
      fromRef.current = target
      return
    }

    const from = fromRef.current.length === target.length ? fromRef.current : target.map(() => 0)
    const start = performance.now()

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      const next = target.map((value, index) => from[index] + (value - from[index]) * eased)
      setValues(next)
      if (t < 1) {
        frame.current = requestAnimationFrame(step)
      } else {
        fromRef.current = target
      }
    }

    if (frame.current) cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(step)

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.join(','), durationMs, enabled])

  return values
}
