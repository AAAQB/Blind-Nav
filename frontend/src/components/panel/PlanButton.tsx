import { useI18n } from '../../lib/i18n'
import { Icon } from '../ui/Icon'
import { Button, Spinner } from '../ui/Primitives'

interface Props {
  onPlan: () => void
  loading: boolean
  refreshing: boolean
  ready: boolean
  autoPlan: boolean
  onToggleAutoPlan: (value: boolean) => void
}

/** Primary call to action plus the auto-recompute switch. */
export function PlanButton({ onPlan, loading, refreshing, ready, autoPlan, onToggleAutoPlan }: Props) {
  const { t } = useI18n()

  return (
    <div className="space-y-2">
      <Button
        variant="primary"
        size="lg"
        block
        onClick={onPlan}
        disabled={loading}
        className="relative overflow-hidden"
      >
        {loading ? <Spinner size={16} /> : <Icon name="route" size={17} />}
        {loading ? t('plan.computing') : ready ? t('plan.recompute') : t('plan.find')}
        {refreshing && !loading ? (
          <span className="text-[10px] opacity-70">{t('plan.live')}</span>
        ) : null}
      </Button>

      <label className="flex cursor-pointer items-center gap-2 px-1 text-[11px] text-subtle">
        <input
          type="checkbox"
          checked={autoPlan}
          onChange={(event) => onToggleAutoPlan(event.target.checked)}
          className="h-3.5 w-3.5 accent-[var(--bn-accent)]"
        />
        {t('plan.autoRecompute')}
      </label>
    </div>
  )
}
