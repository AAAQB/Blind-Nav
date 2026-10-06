import { useState, type ReactNode } from 'react'
import { useI18n } from '../../lib/i18n'
import type { AreaMeta, LatLon, Meta, Place, ProfileId, Severity } from '../../lib/types'
import type { UsePlacesResult } from '../../hooks/usePlaces'
import { Icon } from '../ui/Icon'
import { Button, Segmented, Switch, Tooltip } from '../ui/Primitives'
import { PlaceSearch } from './PlaceSearch'
import { RouteInputs } from './RouteInputs'
import { RegionPicker } from './RegionPicker'
import { ProfilePicker } from './ProfilePicker'
import { TimeSlider } from './TimeSlider'
import { PlanButton } from './PlanButton'
import { ThemeControls } from './ThemeControls'

export interface ControlPanelProps {
  meta: Meta | null
  loadedArea: string | null
  start: LatLon | null
  end: LatLon | null
  startLabel: string | null
  endLabel: string | null
  picking: 'start' | 'end' | null
  onArmPick: (kind: 'start' | 'end' | null) => void
  onCoordChange: (kind: 'start' | 'end', point: LatLon) => void
  onClearPoint: (kind: 'start' | 'end') => void
  onSwap: () => void
  search: UsePlacesResult
  onSelectPlace: (place: Place) => void
  onUseMyLocation: () => void
  locating: boolean
  activeArea: string | null
  onJumpArea: (area: AreaMeta) => void
  profiles: ProfileId[]
  onToggleProfile: (id: ProfileId) => void
  hour: number
  onHourChange: (hour: number) => void
  autoPlan: boolean
  onToggleAutoPlan: (value: boolean) => void
  dynamicCost: boolean
  onToggleDynamicCost: (value: boolean) => void
  riskPins: boolean
  onToggleRiskPins: (value: boolean) => void
  riskFloor: Severity
  onRiskFloorChange: (value: Severity) => void
  planning: boolean
  refreshing: boolean
  hasRoutes: boolean
  onPlan: () => void
  onReset: () => void
  onShowShortcuts: () => void
}

function Section({
  title,
  icon,
  hint,
  children,
  defaultOpen = true,
  actions,
}: {
  title: string
  icon: string
  hint?: string
  children: ReactNode
  defaultOpen?: boolean
  actions?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-b border-line pb-3.5 last:border-b-0 last:pb-0">
      <header className="flex items-center gap-2 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <Icon name={icon} size={13} className="text-accent" />
          <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">{title}</span>
          <Icon
            name="chevron-down"
            size={13}
            className={['ml-0.5 text-subtle transition-transform duration-300', open ? '' : '-rotate-90'].join(' ')}
          />
        </button>
        {actions}
      </header>
      {open ? (
        <div className="anim-fade space-y-2.5">
          {hint ? <p className="text-[10.5px] leading-snug text-subtle">{hint}</p> : null}
          {children}
        </div>
      ) : null}
    </section>
  )
}

/** Left-hand control surface: everything needed to describe a journey. */
export function ControlPanel(props: ControlPanelProps) {
  const {
    meta,
    loadedArea,
    start,
    end,
    startLabel,
    endLabel,
    picking,
    onArmPick,
    onCoordChange,
    onClearPoint,
    onSwap,
    search,
    onSelectPlace,
    onUseMyLocation,
    locating,
    activeArea,
    onJumpArea,
    profiles,
    onToggleProfile,
    hour,
    onHourChange,
    autoPlan,
    onToggleAutoPlan,
    dynamicCost,
    onToggleDynamicCost,
    riskPins,
    onToggleRiskPins,
    riskFloor,
    onRiskFloorChange,
    planning,
    refreshing,
    hasRoutes,
    onPlan,
    onReset,
    onShowShortcuts,
  } = props

  const { t } = useI18n()

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3.5">
        <span
          className="grid h-9 w-9 place-items-center rounded-panel border border-line"
          style={{ background: 'linear-gradient(140deg, var(--bn-halo-a), var(--bn-halo-b))' }}
        >
          <Icon name="compass" size={19} className="text-accent" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] font-extrabold leading-none tracking-tight text-fg">
            Blind<span className="text-accent">Nav</span>
          </h1>
          <p className="mt-0.5 truncate text-[10px] leading-tight text-subtle">{t('app.tagline')}</p>
        </div>
        <ThemeControls onShowShortcuts={onShowShortcuts} />
      </header>

      <div className="scrollarea flex-1 px-4 py-1">
        <Section title={t('section.whereTo')} icon="search" defaultOpen>
          <PlaceSearch
            query={search.query}
            onQueryChange={search.setQuery}
            results={search.results}
            loading={search.loading}
            error={search.error}
            onSelect={onSelectPlace}
            onUseMyLocation={onUseMyLocation}
            locating={locating}
          />
        </Section>

        <Section title={t('section.startEnd')} icon="pin">
          <RouteInputs
            start={start}
            end={end}
            startLabel={startLabel}
            endLabel={endLabel}
            picking={picking}
            onArmPick={onArmPick}
            onChange={onCoordChange}
            onClear={onClearPoint}
            onSwap={onSwap}
          />
        </Section>

        <Section title={t('section.region')} icon="globe" defaultOpen={false} hint={t('region.hint')}>
          <RegionPicker
            areas={meta?.areas ?? []}
            activeArea={activeArea}
            onJump={onJumpArea}
            loadedArea={loadedArea}
          />
        </Section>

        <Section title={t('section.alternatives')} icon="sliders" hint={t('profiles.hint')}>
          <ProfilePicker
            profiles={meta?.profiles ?? []}
            selected={profiles}
            onToggle={onToggleProfile}
            max={meta?.max_profiles ?? 4}
          />
        </Section>

        <Section title={t('section.departure')} icon="clock">
          <TimeSlider hour={hour} onChange={onHourChange} slots={meta?.time_slots ?? []} />
        </Section>

        <Section title={t('section.options')} icon="gauge" defaultOpen={false}>
          <div className="space-y-3">
            <Switch
              checked={dynamicCost}
              onChange={onToggleDynamicCost}
              label={t('options.dynamicCost')}
              hint={t('options.dynamicCostHint')}
              icon="clock"
            />
            <Switch
              checked={riskPins}
              onChange={onToggleRiskPins}
              label={t('options.riskPins')}
              hint={t('options.riskPinsHint')}
              icon="warning"
            />
            <Switch
              checked={autoPlan}
              onChange={onToggleAutoPlan}
              label={t('options.autoPlan')}
              hint={t('options.autoPlanHint')}
              icon="refresh"
            />
            {riskPins ? (
              <div className="space-y-1.5">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-subtle">
                  {t('options.showFrom')}
                </span>
                <Segmented<Severity>
                  ariaLabel={t('options.showFrom')}
                  value={riskFloor}
                  onChange={onRiskFloorChange}
                  options={[
                    { value: 'low' as Severity, label: t('options.mediaAll') },
                    { value: 'medium' as Severity, label: t('options.mediaCaution') },
                    { value: 'high' as Severity, label: t('options.mediaHigh') },
                  ]}
                />
              </div>
            ) : null}
          </div>
        </Section>
      </div>

      <footer className="space-y-2.5 border-t border-line px-4 py-3.5">
        <PlanButton
          onPlan={onPlan}
          loading={planning}
          refreshing={refreshing}
          ready={hasRoutes}
          autoPlan={autoPlan}
          onToggleAutoPlan={onToggleAutoPlan}
        />
        <div className="flex items-center gap-2">
          <Tooltip label={t('plan.resetHint')}>
            <Button variant="ghost" size="sm" icon="refresh" onClick={onReset}>
              {t('plan.reset')}
            </Button>
          </Tooltip>
          <span className="ml-auto text-[10px] text-subtle">
            {t('plan.shortcutHint', { key: '?' })}
          </span>
        </div>
      </footer>
    </div>
  )
}
