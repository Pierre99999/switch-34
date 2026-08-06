import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'

// Mints the private link for one briefing, once. Calling it again returns the
// same token rather than a second one — a briefing with two live links is a
// briefing you cannot revoke.
//
// The token is created only when the seller asks for it: a link that exists by
// default is a link that leaks by default.

export async function POST(req: NextRequest) {
  const { roundId } = await req.json()
  if (!roundId) return NextResponse.json({ error: 'roundId manquant' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Read through the caller's own session: RLS is what proves the round is
  // theirs, so ownership is never a check this route has to remember to make.
  const { data: round, error } = await supabase
    .from('deal_rounds')
    .select('id, briefing_share_token, briefing_line')
    .eq('id', roundId)
    .single()

  if (error || !round) return NextResponse.json({ error: 'Round introuvable' }, { status: 404 })
  if (!round.briefing_line) {
    return NextResponse.json({ error: 'Ce round n’a pas encore de briefing.' }, { status: 400 })
  }

  if (round.briefing_share_token) {
    return NextResponse.json({ token: round.briefing_share_token })
  }

  const token = randomBytes(24).toString('base64url')
  const { error: saveErr } = await supabase
    .from('deal_rounds').update({ briefing_share_token: token }).eq('id', roundId)
  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 })

  return NextResponse.json({ token })
}
