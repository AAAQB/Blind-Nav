import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import type { Place } from '../../lib/types'
import { Icon } from '../ui/Icon'
import { Spinner } from '../ui/Primitives'

interface Props {
  query: string
  onQueryChange: (value: string) => void
  results: Place[]
  loading: boolean
  error: string | null
  onSelect: (place: Place) => void
  onUseMyLocation: () => void
  locating: boolean
}

/**
 * Forward geocoding with full keyboard support: the list behaves like a
 * combobox, so a keyboard-only or screen-reader user never needs the mouse.
 */
export function PlaceSearch({
  query,
  onQueryChange,
  results,
  loading,
  error,
  onSelect,
  onUseMyLocation,
  locating,
}: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrapper = useRef<HTMLDivElement>(null)
  const listId = 'bn-search-results'
  const { t } = useI18n()

  useEffect(() => {
    setActive(0)
    setOpen(results.length > 0)
  }, [results])

  useEffect(() => {
    const onClickAway = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [])

  const commit = (place: Place) => {
    onSelect(place)
    onQueryChange('')
    setOpen(false)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((index) => Math.min(index + 1, Math.max(results.length - 1, 0)))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => Math.max(index - 1, 0))
      return
    }
    if (event.key === 'Enter' && open && results[active]) {
      event.preventDefault()
      commit(results[active])
      return
    }
    if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapper} className="relative">
      <div className="flex items-center gap-2 rounded-chip border border-line bg-bg-elev/40 px-3 py-2 transition-colors focus-within:border-accent">
        <Icon name="search" size={15} className="text-subtle" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => results.length && setOpen(true)}
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="min-w-0 flex-1 bg-transparent text-[12.5px] text-fg outline-none placeholder:text-subtle"
        />
        {loading ? <Spinner size={13} className="text-accent" /> : null}
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            aria-label={t('search.clear')}
            className="text-subtle transition-colors hover:text-fg"
          >
            <Icon name="x" size={14} />
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onUseMyLocation}
        disabled={locating}
        className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-chip border border-line border-dashed px-3 py-1.5 text-[11.5px] font-medium text-muted transition-colors hover:border-accent hover:text-fg disabled:opacity-50"
      >
        {locating ? <Spinner size={12} /> : <Icon name="locate" size={13} />}
        {locating ? t('search.locating') : t('search.useMyLocation')}
      </button>

      {open && (results.length > 0 || error) ? (
        <ul
          id={listId}
          role="listbox"
          className="glass anim-rise absolute z-40 mt-1.5 max-h-64 w-full overflow-y-auto scrollarea p-1"
        >
          {error ? <li className="px-3 py-2 text-[11.5px] text-danger">{error}</li> : null}
          {results.map((place, index) => (
            <li key={`${place.id}-${index}`} role="option" aria-selected={index === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => commit(place)}
                className={[
                  'flex w-full items-start gap-2 rounded-chip px-2.5 py-2 text-left transition-colors',
                  index === active ? 'bg-accent/15' : 'hover:bg-surface',
                ].join(' ')}
              >
                <Icon name="pin" size={14} className="mt-0.5 text-accent" />
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold text-fg">
                    {place.name || place.label.split(',')[0]}
                  </span>
                  <span className="block truncate text-[10.5px] text-subtle">{place.label}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
