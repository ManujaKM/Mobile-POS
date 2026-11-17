export type StartTab = 'dashboard' | 'overview' | 'orders' | 'products'
export type StartPeriod = 'today' | 'week' | 'month'

export type ThemeMode = 'light' | 'dark'

export type PortalPrefs = {
  startTab: StartTab
  startPeriod: StartPeriod
  showCents: boolean
  rememberStore: boolean
  theme: ThemeMode
}

export const STORE_KEY = 'mentura-portal-store'
const PREFS_KEY = 'mentura-portal-prefs'

export const defaultPrefs: PortalPrefs = {
  startTab: 'dashboard',
  startPeriod: 'today',
  showCents: true,
  rememberStore: true,
  theme: 'light',
}

export function loadPrefs(): PortalPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return defaultPrefs
    const parsed = JSON.parse(raw) as Partial<PortalPrefs>
    const startTab = parsed.startTab
    const startPeriod = parsed.startPeriod
    return {
      startTab:
        startTab === 'overview' || startTab === 'orders' || startTab === 'products' || startTab === 'dashboard'
          ? startTab
          : defaultPrefs.startTab,
      startPeriod:
        startPeriod === 'week' || startPeriod === 'month' || startPeriod === 'today'
          ? startPeriod
          : defaultPrefs.startPeriod,
      showCents: parsed.showCents !== false,
      rememberStore: parsed.rememberStore !== false,
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
    }
  } catch {
    return defaultPrefs
  }
}

export function applyTheme(theme: ThemeMode) {
  document.getElementById('mentura-portal-root')?.setAttribute('data-theme', theme)
}

export function savePrefs(prefs: PortalPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

export function readRememberedStore(remember: boolean): string | null {
  if (!remember) return null
  return localStorage.getItem(STORE_KEY) || sessionStorage.getItem(STORE_KEY)
}

export function writeRememberedStore(id: string, remember: boolean) {
  sessionStorage.setItem(STORE_KEY, id)
  if (remember) localStorage.setItem(STORE_KEY, id)
}
