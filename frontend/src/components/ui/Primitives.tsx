import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { Icon } from './Icon'

/* ══════════════════════════════════════════════════════════════════
   Small, dependency-free primitives. They exist so the visual language
   (radii, focus rings, motion) is defined once and reused everywhere.
   ══════════════════════════════════════════════════════════════════ */

type Variant = 'primary' | 'outline' | 'ghost' | 'subtle' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    'bg-accent text-bg hover:brightness-110 border border-transparent shadow-[0_6px_24px_-10px_var(--bn-accent)]',
  outline: 'bg-transparent text-fg border border-line-strong hover:bg-surface hover:border-accent',
  ghost: 'bg-transparent text-muted border border-transparent hover:bg-surface hover:text-fg',
  subtle: 'bg-surface text-fg border border-line hover:border-line-strong',
  danger: 'bg-danger text-white border border-transparent hover:brightness-110',
}

const SIZE_CLASS: Record<Size, string> = {
  sm: 'text-[11px] px-2.5 py-1.5 gap-1.5 rounded-chip',
  md: 'text-[12.5px] px-3.5 py-2 gap-2 rounded-chip',
  lg: 'text-sm px-4 py-3 gap-2.5 rounded-panel font-semibold',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: string
  iconEnd?: string
  loading?: boolean
  block?: boolean
}

export function Button({
  variant = 'subtle',
  size = 'md',
  icon,
  iconEnd,
  loading = false,
  block = false,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center font-medium',
        'transition-all duration-200 ease-out',
        'disabled:opacity-45 disabled:cursor-not-allowed',
        'enabled:hover:-translate-y-px enabled:active:translate-y-0',
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        block ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {loading ? <Spinner size={size === 'lg' ? 16 : 13} /> : icon ? <Icon name={icon} size={size === 'lg' ? 17 : 14} /> : null}
      {children}
      {iconEnd && !loading ? <Icon name={iconEnd} size={size === 'lg' ? 17 : 14} /> : null}
    </button>
  )
}

export function IconButton({
  icon,
  label,
  active = false,
  size = 16,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: string
  label: string
  active?: boolean
  size?: number
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active || undefined}
        className={[
          'grid place-items-center rounded-chip border transition-all duration-200',
          'h-8 w-8',
          active
            ? 'bg-accent text-bg border-accent'
            : 'bg-transparent text-muted border-transparent hover:text-fg hover:bg-surface hover:border-line',
          className,
        ].join(' ')}
        {...rest}
      >
        <Icon name={icon} size={size} />
      </button>
    </Tooltip>
  )
}

export function Spinner({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={['inline-block rounded-full border-2 border-current border-t-transparent', className].join(' ')}
      style={{ width: size, height: size, animation: 'bn-spin 0.7s cubic-bezier(.6,0,.4,1) infinite' }}
      aria-hidden
    />
  )
}

/** Selectable chip used for regions, profiles and map factors. */
export function Pill({
  active = false,
  accent,
  icon,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean
  accent?: string
  icon?: string
}) {
  const style = active && accent ? { background: accent, borderColor: accent, color: '#04121b' } : undefined
  return (
    <button
      type="button"
      aria-pressed={active}
      style={style}
      className={[
        'inline-flex items-center justify-center gap-1.5 rounded-chip border px-2.5 py-2',
        'text-[12px] font-medium transition-all duration-200 ease-out',
        active
          ? 'bg-accent text-bg border-accent shadow-[0_6px_20px_-12px_var(--bn-accent)]'
          : 'bg-transparent text-muted border-line hover:text-fg hover:border-line-strong hover:-translate-y-px',
        className,
      ].join(' ')}
      {...rest}
    >
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </button>
  )
}

export function Badge({
  children,
  color,
  icon,
  className = '',
}: {
  children: ReactNode
  color?: string
  icon?: string
  className?: string
}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        className,
      ].join(' ')}
      style={
        color
          ? { color, borderColor: `${color}55`, background: `${color}14` }
          : undefined
      }
    >
      {icon ? <Icon name={icon} size={11} /> : null}
      {children}
    </span>
  )
}

export function Card({
  title,
  icon,
  actions,
  children,
  className = '',
  padded = true,
}: {
  title?: ReactNode
  icon?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <section
      className={['glass-soft overflow-hidden', className].join(' ')}
      style={padded ? undefined : undefined}
    >
      {title ? (
        <header className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
          {icon ? <Icon name={icon} size={14} className="text-accent" /> : null}
          <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{title}</h3>
          <div className="ml-auto flex items-center gap-1">{actions}</div>
        </header>
      ) : null}
      <div className={padded ? 'p-3.5' : ''}>{children}</div>
    </section>
  )
}

export function Skeleton({ h = 12, w = '100%', className = '' }: { h?: number; w?: number | string; className?: string }) {
  return <div className={['skeleton', className].join(' ')} style={{ height: h, width: w }} />
}

export function Switch({
  checked,
  onChange,
  label,
  hint,
  icon,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint?: string
  icon?: string
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-3">
      {icon ? <Icon name={icon} size={15} className="text-muted" /> : null}
      <label htmlFor={id} className="flex-1 cursor-pointer text-[12.5px] leading-tight">
        <span className="font-medium text-fg">{label}</span>
        {hint ? <span className="mt-0.5 block text-[11px] text-subtle">{hint}</span> : null}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={[
          'relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-200',
          checked ? 'border-accent bg-accent' : 'border-line-strong bg-transparent',
        ].join(' ')}
      >
        <span
          className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-bg transition-all duration-200"
          style={{ left: checked ? 18 : 3, background: checked ? 'var(--bn-bg)' : 'var(--bn-fg-muted)' }}
        />
      </button>
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: {
  options: { value: T; label: string; icon?: string; hint?: string }[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={['flex gap-0.5 rounded-chip border border-line bg-bg-elev/40 p-0.5', className].join(' ')}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={active}
            title={option.hint}
            onClick={() => onChange(option.value)}
            className={[
              'flex flex-1 items-center justify-center gap-1.5 rounded-[6px] px-2 py-1.5',
              'text-[11px] font-semibold transition-all duration-200',
              active ? 'bg-accent text-bg' : 'text-muted hover:text-fg',
            ].join(' ')}
          >
            {option.icon ? <Icon name={option.icon} size={13} /> : null}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** Lightweight tooltip that also works for keyboard users (focus-visible). */
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const [visible, setVisible] = useState(false)
  const timer = useRef<number | null>(null)

  const show = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setVisible(true), 320)
  }, [])

  const hide = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current)
    setVisible(false)
  }, [])

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  if (!label) return <>{children}</>

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
    >
      {children}
      {visible ? (
        <span
          role="tooltip"
          className="anim-fade pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md border border-line-strong bg-surface-solid px-2 py-1 text-[10.5px] font-medium text-fg shadow-[var(--bn-shadow-float)]"
        >
          {label}
        </span>
      ) : null}
    </span>
  )
}

export function Stat({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string
  value: ReactNode
  hint?: string
  icon?: string
  accent?: string
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
        {icon ? <Icon name={icon} size={11} /> : null}
        {label}
      </div>
      <div className="tnum mt-0.5 truncate text-[15px] font-bold text-fg" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {hint ? <div className="truncate text-[10.5px] text-subtle">{hint}</div> : null}
    </div>
  )
}

export function EmptyHint({
  icon = 'info',
  title,
  children,
}: {
  icon?: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className="anim-fade flex flex-col items-center gap-2 px-4 py-7 text-center">
      <span className="grid h-9 w-9 place-items-center rounded-full border border-line text-subtle">
        <Icon name={icon} size={16} />
      </span>
      <p className="text-[12.5px] font-semibold text-fg">{title}</p>
      {children ? <p className="max-w-[34ch] text-[11.5px] leading-relaxed text-subtle">{children}</p> : null}
    </div>
  )
}

/** Horizontal label/value rows used across the analysis panels. */
export function MetricRow({
  label,
  value,
  percent,
  color,
  delay = 0,
}: {
  label: string
  value: ReactNode
  percent?: number
  color?: string
  delay?: number
}) {
  return (
    <div className="anim-rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
        <span className="text-muted">{label}</span>
        <span className="tnum font-semibold text-fg">{value}</span>
      </div>
      {percent !== undefined ? (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${Math.max(0, Math.min(100, percent))}%`, background: color ?? 'var(--bn-accent)' }}
          />
        </div>
      ) : null}
    </div>
  )
}
