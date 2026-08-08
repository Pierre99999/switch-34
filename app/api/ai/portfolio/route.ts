export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildVendorContext } from '@/lib/ai-context'
import { localeInstruction } from '@/lib/ai-locale'
import { recordUsage } from '@/lib/ai-usage'
import { computeDealState, dealScore, prescriptions } from '@/lib/scoring'
import { nextStep } from '@/lib/deal-rounds'
import { criterionLabel } from '@/lib/lab-view'
import { normalizeFit } from '@/lib/playbook-fit'
import { daysSinceActivity } from '@/lib/mission-control'
import type { Deal, DealRound } from '@/lib/types'

const client = new Anthropic()

// Answers questions about the whole portfolio, from the diagnostic state of
// every active deal and nothing else.
//
// The per-deal context is deliberately thin — scores, gate status, what blocks,
// how long it has been quiet. A question about a portfolio is a question about
// comparison and priority, and shipping every transcript of every deal would
// bury that under material the answer does not need.
//
// Same refusals as the single-deal copilot: no prediction, no invented fact,
// no softening. Ranking twelve deals is exactly where a fluent model would be
// tempted to produce a confident order out of nothing.
export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  try {
    const { question, locale } = await req.json()
    if (!question || !String(question).trim()) {
      return NextResponse.json({ error: 'No question provided' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [{ data: vendor }, { data: dealRows }] = await Promise.all([
      supabase.from('vendors').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('deals').select('*').eq('status', 'active').order('updated_at', { ascending: false }),
    ])

    const deals = (dealRows ?? []) as Deal[]
    if (deals.length === 0) {
      return NextResponse.json({ answer: 'Aucun deal actif dans votre portefeuille pour l’instant.' })
    }

    const { data: roundRows } = await supabase
      .from('deal_rounds').select('*').in('deal_id', deals.map(d => d.id))
      .order('round', { ascending: true })

    const byDeal: Record<string, DealRound[]> = {}
    for (const r of (roundRows ?? []) as DealRound[]) {
      (byDeal[r.deal_id] ??= []).push(r)
    }

    const now = Date.now()
    const lines = deals.map(deal => {
      const rounds = byDeal[deal.id] ?? []
      const current = rounds.find(r => r.round === deal.current_round) ?? null
      const state = computeDealState(rounds, deal.current_round)
      const step = nextStep(deal, rounds)
      const fit = normalizeFit(deal.playbook_fit)
      const idle = daysSinceActivity(rounds, now)
      const weak = prescriptions(current).slice(0, 3)
        .map(p => `${criterionLabel(p.variable)} (${p.kind.toLowerCase()})`)

      return [
        `— ${deal.prospect_name}`,
        `  round ${deal.current_round}, note globale ${dealScore(current) ?? '—'}/5, CA ${deal.potential_revenue ?? '—'}`,
        `  portes: ${[1, 2, 3].map(g => `P${g} ${state.gates[g]?.status ?? 'EMPTY'} ${state.gates[g]?.score ?? '—'}`).join(' · ')}`,
        `  momentum: ${state.momentum.score ?? '—'} ${state.momentum.status}${state.momentum.stagnant ? ' (stagnant)' : ''}`,
        `  prochaine étape: ${step.kind} (round ${step.round})`,
        idle !== null ? `  dernière capture il y a ${idle} jours` : '  aucune conversation capturée',
        weak.length ? `  points faibles: ${weak.join(', ')}` : '',
        fit?.avoid_list_hit ? '  ⚠ correspond à un segment de la liste à fuir' : '',
      ].filter(Boolean).join('\n')
    })

    const context = [
      vendor ? buildVendorContext(vendor) : '',
      `PORTEFEUILLE — ${deals.length} deals actifs :`,
      lines.join('\n'),
    ].filter(Boolean).join('\n\n')

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: `You answer questions about a seller's WHOLE portfolio, using Pierre Gaubil's Switch methodology. Everything you know is the state below.

WHAT YOU MAY DO
- Compare deals on what the state holds: gate status, evidence, momentum, what blocks each one, how long each has been quiet.
- Rank and prioritise, saying on what basis. The method's own order: a deal that cannot be won is settled before a deal that can be advanced.
- Name the deals. A portfolio answer that does not name deals is useless.

WHAT YOU MAY NOT DO
- Predict. No probability of signature, no expected revenue, no "this one will close". If asked, say plainly that nothing in the diagnostic answers that, and give what IS known.
- Invent a fact, a figure or a person absent from the state.
- Soften. A portfolio where three deals are stuck should read as three deals stuck.
- Rank on revenue alone. A large deal with a broken gate 1 is not a priority, it is a large risk.

STYLE
- Four to eight sentences, or a short list when the question asks to rank.
- Always say what the claim rests on: "porte 1 à risque", "aucune capture depuis 23 jours", "seulement déclaré".
- "Rien dans le diagnostic ne le dit" is a correct answer.` + localeInstruction(locale),
      messages: [{ role: 'user', content: `${context}\n\n---\n\nQUESTION DU VENDEUR : ${String(question).trim()}` }],
    })

    await recordUsage(supabase, { userId: user.id, route: 'ai/portfolio', model: 'claude-sonnet-4-6', usage: message.usage })

    const text = message.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('\n').trim()
    if (!text) return NextResponse.json({ error: 'No answer from AI' }, { status: 500 })

    return NextResponse.json({ answer: text })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown AI error' }, { status: 500 })
  }
}
