import { createClient } from '@supabase/supabase-js'
export { ADMIN_EMAIL } from '@/lib/admin-config'

// Service-role client — bypasses RLS. SERVER-ONLY. Never import from client code.
// Requires SUPABASE_SERVICE_ROLE_KEY (Supabase → Settings → API → service_role).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}
