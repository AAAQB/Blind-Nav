import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ThemeId = 'dark' | 'light' | 'contrast'

export const THEME_ORDER: ThemeId[] = ['dark', 'light', 'contrast']

export const THEME_META: Record<ThemeId, { label: string; hint: string; icon: string }> = {
  dark: { label: 'Neon night', hint: 'Deep-space dark theme', icon: 'moon' },
  light: { label: 'Daylight glass', hint: 'Frosted light theme', icon: 'sun' },
  contrast: { label: 'High contrast', hint: 'Maximum legibility, larger type', icon: 'contrast' },
}

interface ThemeValue {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
  cycleTheme: () => void
  motion: boolean
  toggleMotion: () => void
  bigType: boolean
  toggleBigType: () => void
}

const ThemeContext = createContext<ThemeValue | null>(null)

const STORAGE_KEY = 'blindnav.theme'

interface StoredPrefs {
  theme: ThemeId
  motion: boolean
  bigType: boolean
}

function readPrefs(): StoredPrefs {
  const fallback: StoredPrefs = { theme: 'dark', motion: true, bigType: false }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<StoredPrefs>
    return {
      theme: THEME_ORDER.includes(parsed.theme as ThemeId) ? (parsed.theme as ThemeId) : 'dark',
      motion: parsed.motion !== false,
      bigType: parsed.bigType === true,
    }
  } catch {
    return fallback
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<StoredPrefs>(() => readPrefs())

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = prefs.theme
    root.dataset.motion = prefs.motion ? 'on' : 'off'
    root.dataset.bigtype = prefs.bigType ? 'on' : 'off'
    root.style.colorScheme = prefs.theme === 'light' ? 'light' : 'dark'
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    } catch {
      /* storage is optional */
    }
  }, [prefs])

  const setTheme = useCallback((theme: ThemeId) => setPrefs((p) => ({ ...p, theme })), [])

  const cycleTheme = useCallback(() => {
    setPrefs((p) => ({
      ...p,
      theme: THEME_ORDER[(THEME_ORDER.indexOf(p.theme) + 1) % THEME_ORDER.length],
    }))
  }, [])

  const toggleMotion = useCallback(() => setPrefs((p) => ({ ...p, motion: !p.motion })), [])
  const toggleBigType = useCallback(() => setPrefs((p) => ({ ...p, bigType: !p.bigType })), [])

  const value = useMemo<ThemeValue>(
    () => ({
      theme: prefs.theme,
      setTheme,
      cycleTheme,
      motion: prefs.motion,
      toggleMotion,
      bigType: prefs.bigType,
      toggleBigType,
    }),
    [prefs, setTheme, cycleTheme, toggleMotion, toggleBigType],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>')
  return value
}
