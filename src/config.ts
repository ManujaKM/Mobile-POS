export type PortalConfig = {
  url: string
  anonKey: string
}

export function readConfig(): PortalConfig | null {
  const injected = window.MENTURA_PORTAL
  const url = (injected?.url || import.meta.env.VITE_SUPABASE_URL || '').trim()
  const anonKey = (injected?.anonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
  if (!url || !anonKey) return null
  return { url, anonKey }
}
