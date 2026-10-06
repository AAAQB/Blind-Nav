import { profileText, useI18n } from '../../lib/i18n'
import type { ProfileId, ProfileMeta } from '../../lib/types'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/Primitives'

interface Props {
  profiles: ProfileMeta[]
  selected: ProfileId[]
  onToggle: (id: ProfileId) => void
  max: number
}

/**
 * Profiles are a multi-select: the map draws every chosen alternative so the
 * trade-off between speed and accessibility is visible side by side.
 */
export function ProfilePicker({ profiles, selected, onToggle, max }: Props) {
  const { t, lang } = useI18n()

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {profiles.map((profile) => {
          const active = selected.includes(profile.id)
          const disabled = !active && selected.length >= max
          const text = profileText(lang, profile.id)
          return (
            <Tooltip
              key={profile.id}
              label={disabled ? t('profiles.limitTooltip', { n: max }) : text.description}
            >
              <button
                type="button"
                aria-pressed={active}
                disabled={disabled}
                onClick={() => onToggle(profile.id)}
                className={[
                  'flex items-center gap-2 rounded-chip border px-2.5 py-2 text-left transition-all duration-200',
                  active
                    ? 'border-transparent text-bg shadow-[0_8px_24px_-14px_rgba(0,0,0,.8)]'
                    : disabled
                      ? 'cursor-not-allowed border-line text-subtle opacity-45'
                      : 'border-line text-muted hover:-translate-y-px hover:border-line-strong hover:text-fg',
                ].join(' ')}
                style={active ? { background: profile.color } : undefined}
              >
                <Icon name={profile.icon} size={14} />
                <span className="text-[12px] font-semibold">{text.short}</span>
                {active ? <Icon name="check" size={12} /> : null}
              </button>
            </Tooltip>
          )
        })}
      </div>
      <p className="text-[10.5px] text-subtle">{t('profiles.max', { n: max })}</p>
    </div>
  )
}
