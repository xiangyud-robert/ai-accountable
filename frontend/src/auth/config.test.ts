import { expect, test } from 'vitest'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, usesSupabase } from './config'

// vite.config.ts builds the Supabase settings in only for `vite build`. So even when the shell has
// them, the tests get them empty, use the stand-in and never reach Supabase (risk 13).
test('the tests always use the stand-in, whatever the shell has', () => {
  expect({ SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, usesSupabase }).toEqual({
    SUPABASE_URL: '',
    SUPABASE_PUBLISHABLE_KEY: '',
    usesSupabase: false,
  })
})
