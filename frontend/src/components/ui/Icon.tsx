import type { CSSProperties } from 'react'

/**
 * Hand-rolled 24×24 stroke icon set.
 *
 * Keeping the icons in-repo (rather than pulling an icon package) means the
 * stroke weight can track the theme — high-contrast mode thickens every glyph
 * so it survives at low vision — and the bundle stays tiny.
 */
const PATHS: Record<string, string[]> = {
  /* ── Brand & navigation ── */
  compass: [
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
    'M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z',
  ],
  route: [
    'M5 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M19 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M5 14V9a4 4 0 0 1 4-4h6',
    'M13 2l4 3-4 3',
  ],
  navigation: ['M3 11l19-9-9 19-2-8-8-2z'],
  layers: ['M12 2l9 5-9 5-9-5 9-5z', 'M3 12l9 5 9-5', 'M3 17l9 5 9-5'],
  map: ['M9 2L3 5v17l6-3 6 3 6-3V2l-6 3-6-3z', 'M9 2v17', 'M15 5v17'],
  globe: [
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
    'M2 12h20',
    'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  ],

  /* ── Places ── */
  pin: ['M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z', 'M12 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'],
  flag: ['M5 22V4l14 5-14 5'],
  target: [
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
    'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z',
    'M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  ],
  locate: ['M12 2v3', 'M12 19v3', 'M2 12h3', 'M19 12h3', 'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z'],
  footpath: ['M6 2l1.5 6L6 22', 'M18 2l-1.5 6L18 22', 'M9 8h6', 'M9 16h6'],

  /* ── Travel modes ── */
  eye: ['M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  'eye-off': [
    'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94',
    'M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.06 3.06',
    'M1 1l22 22',
  ],
  wheelchair: ['M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z', 'M10 20a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M10 14h7l2 4', 'M14 10h-4'],
  elderly: [
    'M12 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
    'M8 22c0-4 2-8 4-8s4 4 4 8',
    'M9 10h6',
    'M6 13c0-3 2.5-5.5 6-5.5s6 2.5 6 5.5',
  ],
  walk: ['M13 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z', 'M11 21l1-5-2-3 1-4', 'M13 9l3 3h3', 'M12 13l-3 8'],
  balance: ['M12 2v20', 'M4 6l8-4 8 4', 'M4 6v6a8 8 0 0 0 16 0V6', 'M4 12h16'],
  starett: [
    'M9 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    'M17 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    'M4 4h3l2 10h10',
    'M5 8h13a2 2 0 0 1 2 2v4H7',
  ],

  /* ── Time ── */
  moon: ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'],
  sun: [
    'M12 3v2',
    'M12 19v2',
    'M5.6 5.6l1.4 1.4',
    'M17 17l1.4 1.4',
    'M3 12h2',
    'M19 12h2',
    'M5.6 18.4L7 17',
    'M17 7l1.4-1.4',
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  ],
  sunrise: ['M12 3v5', 'M4.2 14.2l1.4-1.4', 'M18.4 12.8l1.4 1.4', 'M2 18h4', 'M18 18h4', 'M8 18a4 4 0 0 1 8 0', 'M12 8l-2.5 2.5', 'M12 8l2.5 2.5'],
  sunset: ['M12 8V3', 'M4.2 14.2l1.4-1.4', 'M18.4 12.8l1.4 1.4', 'M2 18h4', 'M18 18h4', 'M8 18a4 4 0 0 1 8 0', 'M9.5 5.5L12 8l2.5-2.5'],
  clock: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 6v6l4 2'],

  /* ── Hazards & analysis ── */
  warning: ['M10.3 3.6L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z', 'M12 9v4', 'M12 17h.01'],
  stairs: ['M3 20h4v-4h4v-4h4V8h4V4h2', 'M3 20v-2'],
  road: ['M4 22L8 2', 'M20 22L16 2', 'M12 5v3', 'M12 12v3', 'M12 19v2'],
  grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
  compress: ['M4 9h5V4', 'M20 15h-5v5', 'M4 15h5v5', 'M20 9h-5V4'],
  trending: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  'bar-chart': ['M12 20V10', 'M18 20V4', 'M6 20v-4'],
  gauge: ['M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z', 'M12 12l4-4'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  routeLine: ['M5 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M6 17.5L18 8.5'],

  /* ── Direction arrows ── */
  'arrow-left': ['M19 12H5', 'M12 19l-7-7 7-7'],
  'arrow-right': ['M5 12h14', 'M13 5l7 7-7 7'],
  'arrow-up': ['M12 19V5', 'M5 12l7-7 7 7'],
  'turn-left': ['M9 20V10a4 4 0 0 1 4-4h6', 'M15 2l-4 4 4 4'],
  'turn-right': ['M15 20V10a4 4 0 0 0-4-4H5', 'M9 2l4 4-4 4'],
  'slight-left': ['M6 20l6-9', 'M6 11h7'],
  'slight-right': ['M18 20l-6-9', 'M11 11h7'],
  straight: ['M12 20V4', 'M6 10l6-6 6 6'],
  uturn: ['M17 20v-9a5 5 0 0 0-10 0v6', 'M4 14l3 3 3-3'],
  destination: ['M12 22s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12z', 'M12 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4z'],
  start: ['M12 22s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12z', 'M12 7v6', 'M9 10h6'],

  /* ── Controls ── */
  search: ['M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M21 21l-4.3-4.3'],
  x: ['M18 6L6 18', 'M6 6l12 12'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  check: ['M20 6L9 17l-5-5'],
  'chevron-down': ['M6 9l6 6 6-6'],
  'chevron-up': ['M18 15l-6-6-6 6'],
  'chevron-right': ['M9 18l6-6-6-6'],
  'chevron-left': ['M15 18l-6-6 6-6'],
  sliders: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
  refresh: ['M21 12a9 9 0 1 1-3-6.7', 'M21 4v5h-5'],
  share: ['M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7', 'M16 6l-4-4-4 4', 'M12 2v13'],
  copy: ['M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
  volume: ['M11 5L6 9H2v6h4l5 4V5z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M18.5 5.5a9 9 0 0 1 0 13'],
  'volume-off': ['M11 5L6 9H2v6h4l5 4V5z', 'M22 9l-6 6', 'M16 9l6 6'],
  keyboard: ['M2 6h20v12H2z', 'M6 10h.01', 'M10 10h.01', 'M14 10h.01', 'M18 10h.01', 'M8 14h8'],
  contrast: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 2v20', 'M12 7a5 5 0 0 1 0 10'],
  sparkles: ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z', 'M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z'],
  zap: ['M13 2L4 14h7l-1 8 9-12h-7l1-8z'],
  info: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 16v-5', 'M12 8h.01'],
  ruler: ['M3 15l6-6', 'M6 3h15v15l-3 3H3V6l3-3z', 'M12 9l-3 3', 'M15 12l-3 3'],
  'zoom-in': ['M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M21 21l-4.3-4.3', 'M11 8v6', 'M8 11h6'],
  'zoom-out': ['M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M21 21l-4.3-4.3', 'M8 11h6'],
  cube: ['M12 2l9 5v10l-9 5-9-5V7l9-5z', 'M3 7l9 5 9-5', 'M12 12v10'],
  crosshair: ['M12 2v4', 'M12 18v4', 'M2 12h4', 'M18 12h4', 'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z'],
  accessibility: ['M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z', 'M5 9h14', 'M12 9v6', 'M12 15l-3 6', 'M12 15l3 6'],
}

export type IconName = keyof typeof PATHS | string

interface IconProps {
  name: IconName
  size?: number
  strokeWidth?: number
  className?: string
  style?: CSSProperties
  label?: string
  fill?: boolean
}

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.7,
  className,
  style,
  label,
  fill = false,
}: IconProps) {
  const paths = PATHS[name] ?? PATHS.info
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0, display: 'block', ...style }}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

export function hasIcon(name: string): boolean {
  return name in PATHS
}
