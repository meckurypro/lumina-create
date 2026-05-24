// REPLACE WITH YOUR FULL src/lib/supabase.js
// Minimal stub so the skeleton boots. Exports the names your pages import.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_URL
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

// Stub exports your pages import — replace with your real implementations.
export const profiles = {}
export const generations = {}
export const credits = {}
export const social = {}
