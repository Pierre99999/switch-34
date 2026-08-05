export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildVendorContext, buildProspectContext, buildScoresContext, buildCaptureContext, buildPrescriptionsContext, buildVoiceContext } from '@/lib/ai-context'
import { type DealRound } from '@/lib/types'
import { computeDealState } from '@/lib/scoring'
import { localeInstruction } from '@/lib/ai-locale'
import { recordUsage } from '@/lib/ai-usage'

const client = new Anthropic()

// Post-conversation situational read. Generated AFTER the round is scored,
// so the dashboard reflects where the deal stands now — not the pre-call plan.
export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  try {
    const { dealId, roundId, locale } = await req.json()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [{ data: deal }, { data: round }, { data: vendor }, { data: allRounds }] = await Promise.all([
      supabase.from('deals').select('*').eq('id', dealId).single(),
      supabase.from('deal_rounds').select('*').eq('id', roundId).single(),
      supabase.from('vendors').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('deal_rounds').select('*').eq('deal_id', dealId).order('round', { ascending: true }),
    ])

    if (!deal || !round) return NextResponse.json({ error: 'Deal or round not found' }, { status: 404 })

    const dealState = computeDealState((allRounds ?? []) as DealRound[], (round as DealRound).round)
    const activeGate = dealState.activeGate

    const context = [
      vendor ? buildVendorContext(vendor) : '',
      buildProspectContext(deal),
      buildScoresContext(round as DealRound),
      buildPrescriptionsContext(round as DealRound),
      buildVoiceContext(round as DealRound),
      buildCaptureContext(allRounds ?? []),
    ].filter(Boolean).join('\n\n')

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: `You are a senior sales coach using Pierre Gaubil's Switch methodology. This round has just been scored from a captured conversation. Write the READ: where the deal ACTUALLY stands now, given the scores and what was said.

- Speak in the present, post-conversation tense: what this round revealed, what the scores now say, what is confirmed, what is still a blind spot.
- Never say "nothing is scored yet" — the round has been scored. Reference the actual scores and gate statuses.
- Name the first gate that is not yet passed (currently Gate ${activeGate}) and what stands between the deal and passing it.
- Be honest and specific: use the real prospect details, the real scores, the real capture notes. 3–5 sentences. No generic coaching.

You also write the OBJECTIVE of the next conversation. It is the sentence the seller reads before picking up the phone, so it must name what to go and DO — not what a score is. "Faire qualifier le scénario décisionnel et identifier le vrai champion" is an objective; "Corroborer l'adéquation des préoccupations" is a score restated. Never mention gates, scores or criterion names in it.` + localeInstruction(locale),
      tools: [
        {
          name: 'save_read',
          description: 'Save the post-conversation read for this round',
          input_schema: {
            type: 'object' as const,
            properties: {
              line: { type: 'string', description: 'One sentence: the single most important thing this round revealed about the deal.' },
              read: { type: 'string', description: 'Where the deal stands now, after this conversation and its scoring. What the scores reveal, what is confirmed, what remains a blind spot. 3–5 sentences.' },
              next_objective: { type: 'string', description: 'The objective of the NEXT conversation, as one short imperative sentence of at most fifteen words. Something to go and do, in the seller\'s language. No gate, no score, no criterion name.' },
              why: { type: 'string', description: 'Why that objective, in ONE sentence of at most twenty-five words. The single reason it matters now — not a summary of the read.' },
            },
            required: ['line', 'read', 'next_objective', 'why'],
          },
        },
      ],
      tool_choice: { type: 'any' as const },
      messages: [{
        role: 'user',
        content: `Write the post-conversation read for round ${round.round}.\n\n${context}`,
      }],
    })

    if (user) await recordUsage(supabase, { userId: user.id, route: 'ai/read', model: 'claude-sonnet-4-6', usage: message.usage, dealId: dealId })

  const toolUse = message.content.find(b => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return NextResponse.json({ error: 'No structured response from AI' }, { status: 500 })
    }
    const input = toolUse.input as { line: string; read: string; next_objective?: string; why?: string }

    const objective = [input.next_objective?.trim(), input.why?.trim()].filter(Boolean).join('\n')
    await supabase.from('deal_rounds').update({
      briefing_line: input.line,
      briefing_read: input.read,
      ...(objective ? { focus_objective: objective } : {}),
    }).eq('id', roundId)

    return NextResponse.json({ ok: true, read: input.read, line: input.line })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown AI error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
