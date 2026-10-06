import { useEffect, useRef } from 'react'
import { useI18n, type StringKey } from '../../lib/i18n'
import { Icon } from '../ui/Icon'
import { Button } from '../ui/Primitives'

const SHORTCUTS: { keys: string[]; key: StringKey }[] = [
  { keys: ['S'], key: 'shortcuts.armStart' },
  { keys: ['E'], key: 'shortcuts.armEnd' },
  { keys: ['Enter'], key: 'shortcuts.plan' },
  { keys: ['1', '2', '3', '4'], key: 'shortcuts.focus' },
  { keys: ['C'], key: 'shortcuts.factor' },
  { keys: ['T'], key: 'shortcuts.theme' },
  { keys: ['B'], key: 'shortcuts.basemap' },
  { keys: ['D'], key: 'shortcuts.terrain3d' },
  { keys: ['V'], key: 'shortcuts.speak' },
  { keys: ['L'], key: 'shortcuts.bigType' },
  { keys: ['?'], key: 'shortcuts.help' },
  { keys: ['Esc'], key: 'shortcuts.esc' },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function ShortcutsDialog({ open, onClose }: Props) {
  const { t } = useI18n()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="anim-fade fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t('shortcuts.title')}
      onClick={onClose}
    >
      <div className="glass anim-pop w-full max-w-md p-4" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center gap-2 border-b border-line pb-3">
          <Icon name="keyboard" size={16} className="text-accent" />
          <h2 className="text-[13px] font-bold text-fg">{t('shortcuts.title')}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('shortcuts.close')}
            className="ml-auto text-subtle transition-colors hover:text-fg"
          >
            <Icon name="x" size={16} />
          </button>
        </header>

        <ul className="grid gap-1.5 py-3">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.key} className="flex items-center gap-3 text-[11.5px]">
              <span className="flex w-[74px] shrink-0 gap-1">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="min-w-6 rounded border border-line-strong bg-bg-elev/50 px-1.5 py-0.5 text-center font-mono text-[10.5px] font-semibold text-fg"
                  >
                    {key}
                  </kbd>
                ))}
              </span>
              <span className="text-muted">{t(shortcut.key)}</span>
            </li>
          ))}
        </ul>

        <footer className="flex items-center justify-between border-t border-line pt-3">
          <p className="text-[10.5px] text-subtle">{t('shortcuts.note')}</p>
          <Button variant="subtle" size="sm" onClick={onClose}>
            {t('shortcuts.gotIt')}
          </Button>
        </footer>
      </div>
    </div>
  )
}
