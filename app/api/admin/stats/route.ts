export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, ADMIN_EMAIL } from '@/lib/supabase/admin'

export async function GET() {
  // Gate: only the admin account, verified from the authenticated session.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || (user.email ?? '').toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server.' }, { status: 500 })
  }

  // All vendors (one per user), all deals, all rounds.
  const [{ data: vendors }, { data: deals }, { data: rounds }] = await Promise.all([
    admin.from('vendors').select('user_id, full_name, company_name, role, locale, created_at'),
    admin.from('deals').select('id, user_id, prospect_name, status, current_round, created_at'),
    admin.from('deal_rounds').select('id, deal_id, briefing_line, capture_notes'),
  ])

  // Emails from auth.
  const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailById = new Map<string, string>()
  const lastSignInById = new Map<string, string | null>()
  for (const u of authList?.users ?? []) {
    emailById.set(u.id, u.email ?? '')
    lastSignInById.set(u.id, u.last_sign_in_at ?? null)
  }

  const dealsByUser = new Map<string, number>()
  for (const d of deals ?? []) dealsByUser.set(d.user_id, (dealsByUser.get(d.user_id) ?? 0) + 1)

  // A round counts as an analyzed conversation once it has capture content.
  const analyzedRounds = (rounds ?? []).filter(r => {
    const notes = (r.capture_notes ?? {}) as Record<string, string>
    return Object.values(notes).some(v => typeof v === 'string' && v.trim())
  }).length
  const briefedRounds = (rounds ?? []).filter(r => !!r.briefing_line).length

  const users = (vendors ?? []).map(v => ({
    email: emailById.get(v.user_id) ?? '—',
    name: v.full_name ?? null,
    company: v.company_name ?? null,
    role: v.role ?? 'unknown',
    locale: v.locale ?? null,
    deals: dealsByUser.get(v.user_id) ?? 0,
    createdAt: v.created_at,
    lastSignIn: lastSignInById.get(v.user_id) ?? null,
  })).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))

  const dealsByStatus: Record<string, number> = {}
  for (const d of deals ?? []) dealsByStatus[d.status ?? 'active'] = (dealsByStatus[d.status ?? 'active'] ?? 0) + 1

  return NextResponse.json({
    totals: {
      users: users.length,
      directors: users.filter(u => u.role === 'director').length,
      sales: users.filter(u => u.role === 'sales').length,
      deals: (deals ?? []).length,
      rounds: (rounds ?? []).length,
      briefedRounds,
      analyzedRounds,
    },
    dealsByStatus,
    users,
  })
}
