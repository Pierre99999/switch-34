import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, ADMIN_EMAIL } from '@/lib/supabase/admin'

// Permanently deletes an account and everything it owns.
//
// Most tables reference auth.users(id) ON DELETE CASCADE (vendors, deals ->
// rounds/boxes/stakeholders, ai_usage, feedback), but two do NOT:
//   organizations.owner_id      -> blocks deleting any director
//   question_templates.created_by
// Those must be cleared first, otherwise deleteUser fails on a foreign key.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || (user.email ?? '').toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  // Never let the admin delete their own account from this screen.
  if (userId === user.id) {
    return NextResponse.json({ error: 'You cannot delete your own account here.' }, { status: 400 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server.' }, { status: 500 })
  }

  // 1. Detach question templates authored by this user (nullable column).
  await admin.from('question_templates').update({ created_by: null }).eq('created_by', userId)

  // 2. Delete organizations they own. Deleting a director dissolves their team:
  //    remaining members are detached first so vendors.organization_id (no
  //    cascade) does not block, then the org goes (templates cascade with it).
  const { data: ownedOrgs } = await admin.from('organizations').select('id').eq('owner_id', userId)
  for (const org of ownedOrgs ?? []) {
    await admin.from('vendors').update({ organization_id: null }).eq('organization_id', org.id)
    const { error: orgErr } = await admin.from('organizations').delete().eq('id', org.id)
    if (orgErr) return NextResponse.json({ error: `Organization: ${orgErr.message}` }, { status: 500 })
  }

  // 3. Now the cascade can do the rest.
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
