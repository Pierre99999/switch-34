export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildProspectContext, buildCaptureContext, hasCaptureContent } from '@/lib/ai-context'
import { normalizePlaybook, playbookToContext, rowHasContent } from '@/lib/playbook'
import { normalizeFit } from '@/lib/playbook-fit'
import { localeInstruction } from '@/lib/ai-locale'
import { recordUsage } from '@/lib/ai-usage'
import type { DealRound } from '@/lib/types'

const client = new Anthropic()

// Reads a deal against the Sales Playbook socle. Deliberately separate from
// suggest-scores: this must not touch a gate score, and folding it in would
// both lengthen that call and blur the two readings.
export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  try {
    const { dealId, locale } = await req.json()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [{ data: deal }, { data: vendor }, { data: allRounds }] = await Promise.all([
      supabase.from('deals').select('*').eq('id', dealId).single(),
      supabase.from('vendors').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('deal_rounds').select('*').eq('deal_id', dealId).order('round', { ascending: true }),
    ])
    if (!deal || !vendor) return NextResponse.json({ error: 'Deal or vendor not found' }, { status: 404 })

    const playbook = normalizePlaybook(vendor.playbook, vendor.locale ?? 'fr')

    // Deterministic refusal: with an empty socle there is no reference to
    // match against, and a verdict would be invented out of nothing.
    const referenceRows =
      playbook.a1_value_proposition.filter(r => rowHasContent(r)).length +
      playbook.a2_ideal_targets.filter(r => rowHasContent(r)).length +
      playbook.a3_positioning.filter(r => rowHasContent(r, ['alternative'])).length +
      playbook.a4_perception.filter(r => rowHasContent(r)).length
    if (referenceRows === 0) {
      return NextResponse.json({
        error: 'Your Sales Playbook is empty. Fill in A1 to A4 before Switch can judge whether a deal fits it.',
      }, { status: 400 })
    }

    const rounds = (allRounds ?? []) as DealRound[]
    const basis = rounds.some(r => hasCaptureContent(r)) ? 'conversation' : 'context'

    const context = [
      playbookToContext(playbook, vendor.locale ?? 'fr'),
      buildProspectContext(deal),
      buildCaptureContext(rounds),
    ].filter(Boolean).join('\n\n')

    const axis = {
      type: 'object' as const,
      properties: {
        verdict: {
          type: 'string', enum: ['aligned', 'partial', 'mismatch', 'unknown'],
          description: 'aligned = clearly matches a socle row. partial = matches loosely or only in part. mismatch = contradicts the socle, or is on the avoid list. unknown = the material says nothing either way.',
        },
        summary: { type: 'string', description: 'One sentence: what we understood about THIS prospect on this axis.' },
        playbook_ref: { type: 'string', description: 'The socle row you matched against, quoted or closely paraphrased. Empty string if verdict is unknown. Never cite a row that is not in the playbook.' },
        gap: { type: 'string', description: 'What is missing, or what the next conversation must settle to confirm this. Empty if aligned and certain.' },
      },
      required: ['verdict', 'summary', 'playbook_ref'],
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: `You judge whether a prospect FITS a sales team's playbook, using Pierre Gaubil's Switch methodology.

This is NOT a health check on the deal — someone else scores that. Your only question is: does this prospect look like the deals this team wins?

For each axis, compare what is known about the prospect against the socle, and cite the socle row you matched.

- segment (from A2): is this prospect one of the ideal segments? Set "mismatch" if it resembles a segment they decided to avoid — that is the most valuable thing you can tell them.
- problem (from A1): is the problem we understand one this team solves?
- value (from A1): does the consequence this team delivers land for this prospect?
- alternative (from A3): what is this prospect really deciding against — a competitor, an in-house build, or doing nothing — and does the team have a relevant difference for it?
- perception (from A4): which of the team's known perception objections are likely alive here?

RULES:
- Cite only rows that exist in the socle. Never invent a segment, a competitor or an objection.
- If the material genuinely says nothing about an axis, return "unknown" with an empty playbook_ref. That is a correct answer, not a failure.
- ${basis === 'context'
    ? 'NOTHING has been captured from a conversation yet. Everything you have comes from the prospect\'s own public material, so every verdict is a HYPOTHESIS. Be correspondingly careful, and use "gap" to say what must be asked to confirm it.'
    : 'A conversation has been captured. Prefer what the prospect actually said over what their website suggests, and say so in the summary.'}
- Set avoid_list_hit to true only when the prospect clearly matches a row of A2's "segments to avoid".` + localeInstruction(locale),
      tools: [
        {
          name: 'save_fit',
          description: 'Save the playbook fit for this deal',
          input_schema: {
            type: 'object' as const,
            properties: {
              segment: axis, problem: axis, value: axis, alternative: axis, perception: axis,
              avoid_list_hit: { type: 'boolean', description: 'True only if the prospect clearly matches a segment the team decided to avoid.' },
            },
            required: ['segment', 'problem', 'value', 'alternative', 'perception'],
          },
        },
      ],
      tool_choice: { type: 'any' as const },
      messages: [{ role: 'user', content: `Judge the fit of this prospect against the socle.\n\n${context}` }],
    })

    await recordUsage(supabase, { userId: user.id, route: 'ai/playbook-fit', model: 'claude-sonnet-4-6', usage: message.usage, dealId })

    const toolUse = message.content.find(b => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return NextResponse.json({ error: 'No structured response from AI' }, { status: 500 })
    }
    const input = toolUse.input as Record<string, { verdict: string; summary: string; playbook_ref: string; gap?: string }> & { avoid_list_hit?: boolean }

    const fit = normalizeFit({
      axes: (['segment', 'problem', 'value', 'alternative', 'perception'] as const)
        .filter(k => input[k])
        .map(k => ({ key: k, ...input[k] })),
      basis,
      computed_at: new Date().toISOString(),
      avoid_list_hit: input.avoid_list_hit === true,
    })
    if (!fit) return NextResponse.json({ error: 'The AI returned no usable axes.' }, { status: 500 })

    await supabase.from('deals').update({ playbook_fit: fit }).eq('id', dealId)

    return NextResponse.json({ ok: true, fit })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown AI error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
