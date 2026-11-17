/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

declare module '*.png' {
  const src: string
  export default src
}

interface Window {
  MENTURA_PORTAL?: {
    url?: string
    anonKey?: string
  }
}
