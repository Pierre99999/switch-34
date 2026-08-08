export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import {
  buildVendorContext, buildProspectContext, buildScoresContext, buildCaptureContext,
  buildPrescriptionsContext, buildVoiceContext, buildFitContext, buildSellerRead,
} from '@/lib/ai-context'
import { localeInstruction } from '@/lib/ai-locale'
import { toPlainText, PLAIN_TEXT_INSTRUCTION } from '@/lib/plain-text'
import { recordUsage } from '@/lib/ai-usage'
import type { DealRound } from '@/lib/types'

const client = new Anthropic()

// Answers questions about one deal, from the diagnostic state and nothing else.
//
// A free-form chat over a methodology tool is the easiest way to destroy it:
// asked "will this close?", a fluent model will produce a plausible answer that
// bypasses every evidence rule the engine enforces. So this one is told, in the
// strongest terms available, that it may only report what the state holds — and
// that "I do not know" is a correct answer.
export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  try {
    const { dealId, question, locale } = await req.json()
    if (!question || !String(question).trim()) {
      return NextResponse.json({ error: 'No question provided' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [{ data: deal }, { data: vendor }, { data: allRounds }] = await Promise.all([
      supabase.from('deals').select('*').eq('id', dealId).single(),
      supabase.from('vendors').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('deal_rounds').select('*').eq('deal_id', dealId).order('round', { ascending: true }),
    ])
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    const rounds = (allRounds ?? []) as DealRound[]
    const current = rounds[rounds.length - 1] ?? null

    const context = [
      vendor ? buildVendorContext(vendor) : '',
      buildProspectContext(deal),
      buildFitContext(deal),
      current ? buildScoresContext(current) : '',
      current ? buildPrescriptionsContext(current) : '',
      current ? buildVoiceContext(current) : '',
      current ? buildSellerRead(current) : '',
      buildCaptureContext(rounds),
    ].filter(Boolean).join('\n\n')

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: `You answer questions about ONE sales deal for a seller using Pierre Gaubil's Switch methodology. Everything you know about this deal is in the state below.

WHAT YOU MAY DO
- Report what the state holds: scores, evidence levels, who said what, what is missing, what blocks a gate.
- Explain the methodology's reasoning: why a gate is blocked, why an evidence level caps a score, why urgency is decisive.
- Suggest what the next conversation should establish, grounded in the prescriptions.

WHAT YOU MAY NOT DO
- Predict the outcome. If asked whether the deal will close, say plainly that nothing in the diagnostic answers that, and give what IS known: which gate is blocked and what would unblock it.
- Invent a fact, a figure, a quote or a person that is not in the state. If the state is silent, say so.
- Soften a weak deal. A seller who reads "it looks promising" from you learns nothing. The evidence caps exist precisely because enthusiasm is not evidence.

STYLE
- Answer in three to six sentences, plainly. No preamble, no bullet lists unless the question genuinely asks for one.
- Cite what backs the claim: "Kevin (décideur) l'a dit au round 2", "seulement déclaré, donc plafonné à 2,5".
- "Je ne sais pas, rien dans le diagnostic ne le dit" is a correct and expected answer.` + localeInstruction(locale) + PLAIN_TEXT_INSTRUCTION,
      messages: [{ role: 'user', content: `${context}\n\n---\n\nQUESTION DU VENDEUR : ${String(question).trim()}` }],
    })

    await recordUsage(supabase, { userId: user.id, route: 'ai/copilot', model: 'claude-sonnet-4-6', usage: message.usage, dealId })

    const text = toPlainText(
      message.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('\n'))
    if (!text) return NextResponse.json({ error: 'No answer from AI' }, { status: 500 })

    return NextResponse.json({ answer: text })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown AI error' }, { status: 500 })
  }
}
