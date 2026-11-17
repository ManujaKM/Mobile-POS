import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readConfig } from './config'

let client: SupabaseClient | null | undefined

export function getClient(): SupabaseClient | null {
  if (client !== undefined) return client
  const config = readConfig()
  if (!config) {
    client = null
    return client
  }
  client = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  return client
}
