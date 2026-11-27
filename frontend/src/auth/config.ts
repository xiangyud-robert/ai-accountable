// Which sign-in the app uses. vite.config.ts builds in the Supabase settings only for `vite build`,
// so the dev server and the tests always get them empty and use the stand-in (risk 13).

declare const __SUPABASE_URL__: string
declare const __SUPABASE_PUBLISHABLE_KEY__: string

export const SUPABASE_URL = __SUPABASE_URL__
/** Supabase's publishable key, the only key the browser holds. It isn't a secret. */
export const SUPABASE_PUBLISHABLE_KEY = __SUPABASE_PUBLISHABLE_KEY__

/** Supabase when the app was built with both settings, the backend's stand-in otherwise (concern 18). */
export const usesSupabase = SUPABASE_URL !== '' && SUPABASE_PUBLISHABLE_KEY !== ''
