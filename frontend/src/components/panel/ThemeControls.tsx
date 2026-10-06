import { LANG_LABEL, LANGS, useI18n, type StringKey } from '../../lib/i18n'
import { THEME_ORDER, useTheme, type ThemeId } from '../../lib/theme'
import { Icon } from '../ui/Icon'
import { IconButton, Tooltip } from '../ui/Primitives'

const ICON_FOR: Record<ThemeId, string> = {
  dark: 'moon',
  light: 'sun',
  contrast: 'contrast',
}

const THEME_KEY: Record<ThemeId, { name: StringKey; hint: StringKey }> = {
  dark: { name: 'theme.dark', hint: 'theme.darkHint' },
  light: { name: 'theme.light', hint: 'theme.lightHint' },
  contrast: { name: 'theme.contrast', hint: 'theme.contrastHint' },
}

/** Theme, language, type-scale, motion and help controls, kept in the header. */
export function ThemeControls({ onShowShortcuts }: { onShowShortcuts: () => void }) {
  const { theme, setTheme, motion, toggleMotion, bigType, toggleBigType } = useTheme()
  const { lang, setLang, t } = useI18n()

  return (
    <div className="flex items-center gap-0.5">
      {THEME_ORDER.map((id) => {
        const label = t(THEME_KEY[id].name)
        return (
          <Tooltip key={id} label={`${label} — ${t(THEME_KEY[id].hint)}`}>
            <button
              type="button"
              aria-label={t('theme.switchTo', { name: label })}
              aria-pressed={theme === id}
              onClick={() => setTheme(id)}
              className={[
                'grid h-7 w-7 place-items-center rounded-chip border transition-all duration-200',
                theme === id
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-transparent text-subtle hover:border-line hover:text-fg',
              ].join(' ')}
            >
              <Icon name={ICON_FOR[id]} size={14} />
            </button>
          </Tooltip>
        )
      })}

      <span className="mx-0.5 h-4 w-px bg-line" />

      {/* Language switch — the interface ships in Chinese and English. */}
      <div
        role="group"
        aria-label={t('lang.switch')}
        className="flex items-center rounded-chip border border-line p-0.5"
      >
        {LANGS.map((code) => (
          <button
            key={code}
            type="button"
            aria-pressed={lang === code}
            onClick={() => setLang(code)}
            className={[
              'rounded-[5px] px-1.5 py-0.5 text-[10.5px] font-bold transition-colors duration-200',
              lang === code ? 'bg-accent text-bg' : 'text-subtle hover:text-fg',
            ].join(' ')}
          >
            {LANG_LABEL[code]}
          </button>
        ))}
      </div>

      <IconButton
        icon="accessibility"
        label={bigType ? t('toolbar.bigTypeOff') : t('toolbar.bigTypeOn')}
        active={bigType}
        size={14}
        onClick={toggleBigType}
        className="h-7 w-7"
      />
      <IconButton
        icon={motion ? 'sparkles' : 'zap'}
        label={motion ? t('toolbar.motionOn') : t('toolbar.motionOff')}
        active={!motion}
        size={14}
        onClick={toggleMotion}
        className="h-7 w-7"
      />
      <IconButton
        icon="keyboard"
        label={t('toolbar.help')}
        size={14}
        onClick={onShowShortcuts}
        className="h-7 w-7"
      />
    </div>
  )
}
