import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, ADMIN_EMAIL } from '@/lib/supabase/admin'

// Mints a ready-to-use account for testing a different context, skipping the
// signup + email + onboarding path entirely. Admin only.
//
// The account is created already email-confirmed, with a generated password
// returned once in the response — it is never stored anywhere else, so the
// caller must copy it before leaving the page.

function generatePassword(): string {
  // Readable but not guessable: 24 hex chars from the crypto RNG.
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return 'Sw!' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || (user.email ?? '').toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server.' }, { status: 500 })
  }

  const body = await req.json()
  const email = String(body.email ?? '').trim().toLowerCase()
  const fullName = String(body.fullName ?? '').trim()
  const companyName = String(body.companyName ?? '').trim()
  const role: 'director' | 'sales' = body.role === 'sales' ? 'sales' : 'director'
  const locale = body.locale === 'en' ? 'en' : 'fr'
  const skipOnboarding = body.skipOnboarding !== false
  const organizationId = body.organizationId ? String(body.organizationId) : null

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  }
  if (email === ADMIN_EMAIL) {
    return NextResponse.json({ error: 'That is the admin address.' }, { status: 400 })
  }
  if (role === 'director' && !companyName) {
    return NextResponse.json({ error: 'A company name is required for a director.' }, { status: 400 })
  }
  if (role === 'sales' && !organizationId) {
    return NextResponse.json({ error: 'Pick the team this rep joins.' }, { status: 400 })
  }

  const password = generatePassword()
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createErr || !created.user) {
    return NextResponse.json({ error: createErr?.message ?? 'Could not create the account.' }, { status: 400 })
  }
  const userId = created.user.id

  // Everything below can fail on its own; roll the auth user back rather than
  // leave an identity with no profile behind (the orphan case from before).
  async function rollback(message: string) {
    await admin!.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  let orgId = organizationId
  let company = companyName
  if (role === 'sales') {
    // A rep inherits the team's name, exactly as the invite-code path does.
    const { data: org } = await admin.from('organizations').select('name').eq('id', organizationId).maybeSingle()
    if (!org) return rollback('That team no longer exists.')
    company = org.name
  }
  if (role === 'director') {
    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .insert({ name: companyName, owner_id: userId })
      .select('id')
      .single()
    if (orgErr || !org) return rollback(`Organization: ${orgErr?.message ?? 'creation failed'}`)
    orgId = org.id
  }

  const { error: vendorErr } = await admin.from('vendors').insert({
    user_id: userId,
    company_name: company || 'Test',
    full_name: fullName || null,
    locale,
    role,
    organization_id: orgId,
    onboarding_completed: skipOnboarding,
  })
  if (vendorErr) return rollback(`Vendor: ${vendorErr.message}`)

  return NextResponse.json({ ok: true, email, password, role })
}
