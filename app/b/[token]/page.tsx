import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import type { DealRound } from '@/lib/types'
import BriefingSheet from '@/components/briefing/BriefingSheet'

// The briefing, alone on a page: on a phone during the call, on a tablet, or
// printed. No navigation, no diagnostic, no scores — the questions to ask and
// nothing that would be awkward if the screen were seen from the other side of
// the table.
//
// Reached by an unguessable token and nothing else, so it is read with the
// service-role client: there is no session here, and there should not be one.
// The seller opens it on a device that never signed in — that is the point.

export const dynamic = 'force-dynamic'

export default async function SharedBriefing({
  params, searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ print?: string }>
}) {
  const { token } = await params
  const { print } = await searchParams

  const supabase = createAdminClient()
  if (!supabase || !token) notFound()

  // Only the briefing columns. A leaked link must not be able to reveal the
  // scores, the evidence or what was said in past conversations.
  const { data: round } = await supabase
    .from('deal_rounds')
    .select('id, round, deal_id, briefing_line, briefing_angle, briefing_questions, briefing_objections, briefing_do_not, briefing_win_condition, briefing_attendees')
    .eq('briefing_share_token', token)
    .maybeSingle()

  if (!round?.briefing_line) notFound()

  const { data: deal } = await supabase
    .from('deals').select('prospect_name').eq('id', round.deal_id).maybeSingle()

  return (
    <BriefingSheet
      round={round as unknown as DealRound}
      prospectName={deal?.prospect_name ?? 'Prospect'}
      autoPrint={print === '1'}
    />
  )
}
