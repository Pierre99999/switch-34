export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildVendorContext, buildProspectContext, buildScoresContext, buildCaptureContext } from '@/lib/ai-context'
import { LAYER_VARIABLES, LAYER_LABELS, type DealRound } from '@/lib/types'
import { localeInstruction } from '@/lib/ai-locale'

const client = new Anthropic()

function getActiveLayer(round: DealRound): number {
  for (const layer of [1, 2, 3, 4]) {
    const vars = LAYER_VARIABLES[layer as keyof typeof LAYER_VARIABLES]
    const scores = vars.map(v => round[v as keyof DealRound] as number | null)
    const filled = scores.filter(s => s !== null) as number[]
    if (filled.length < vars.length) return layer
    const avg = filled.reduce((a, b) => a + b, 0) / filled.length
    if (avg < 3.0) return layer
  }
  return 4
}

const LAYER_GATE: Record<number, string> = {
  1: 'Stay or not? — Establish whether a real business problem exists, that personal pain is present, that our terrain fits, and who the real stakeholders are.',
  2: 'Can we win? — Establish our credibility, validate value/solution fit, understand urgency and competitive position.',
  3: 'Is there impact? — Establish that our product can deliver, implementation is feasible, adoption is realistic, impact is tangible.',
  4: 'What forces govern the decision? — Map accelerating, braking, and ambivalent forces.',
}

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

    const activeLayer = getActiveLayer(round as DealRound)
    const gateDescription = LAYER_GATE[activeLayer]
    const activeLayerLabel = LAYER_LABELS[activeLayer]
    const opportunisticLayers = [2, 3, 4].filter(l => l > activeLayer)
    const opportunisticDesc = opportunisticLayers.map(l => `L${l} (${LAYER_LABELS[l]})`).join(', ')

    const context = [
      vendor ? buildVendorContext(vendor) : '',
      buildProspectContext(deal),
      buildScoresContext(round as DealRound),
      buildCaptureContext(allRounds ?? []),
    ].filter(Boolean).join('\n\n')

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: `You are a sales coach generating a briefing using Pierre Gaubil's Switch methodology.

PRINCIPLES: Sell = build understanding that makes a decision possible. Problems justify decisions; personal pains trigger them. No urgency = no deal. Sell the minimum value that triggers the decision.

LAYERS: L1 Opportunity (problem, pain, terrain, stakeholders) → L2 Winability (credibility, value fit, urgency, competition) → L3 Impact (product, implementation, adoption) → L4 Momentum (accelerating/braking/ambivalent forces).

ACTIVE LAYER: ${activeLayer} — ${activeLayerLabel}. ${gateDescription}

QUESTIONS: Use 4 families naturally — open, deepening, challenge, validation. Suggest a reformulation angle (constructed data). Generate 4 pressing questions for L${activeLayer} + 2 opportunistic for higher layers (${opportunisticDesc}). Max 6. Each has sub-questions. When urgency is weak, include cost of inaction.

Be specific — use actual prospect details, scores, capture notes.` + localeInstruction(locale),
      tools: [
        {
          name: 'save_briefing',
          description: 'Save the generated briefing',
          input_schema: {
            type: 'object' as const,
            properties: {
              line: { type: 'string', description: 'One sentence framing the conversation.' },
              read: { type: 'string', description: 'Where the deal stands. 3-5 sentences.' },
              angle: { type: 'string', description: 'Diagnostic objective + one reformulation hypothesis. 3-5 sentences.' },
              win_condition: { type: 'string', description: 'What makes this conversation a success.' },
              questions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    layer: { type: 'number' },
                    variable: { type: 'string' },
                    intent: { type: 'string' },
                    text: { type: 'string' },
                    sub_questions: { type: 'array', items: { type: 'string' } },
                    priority: { type: 'string', enum: ['pressing', 'opportunistic'] },
                  },
                  required: ['layer', 'variable', 'intent', 'text', 'sub_questions', 'priority'],
                },
              },
              mirror: { type: 'array', items: { type: 'string' } },
              objections: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    likely: { type: 'string' },
                    frame: { type: 'string' },
                  },
                  required: ['likely', 'frame'],
                },
              },
              do_not: { type: 'array', items: { type: 'string' } },
            },
            required: ['line', 'read', 'angle', 'win_condition', 'questions', 'mirror', 'objections', 'do_not'],
          },
        },
      ],
      tool_choice: { type: 'any' as const },
      messages: [{
        role: 'user',
        content: `Generate briefing for round ${round.round}. Active layer: L${activeLayer} (${activeLayerLabel}). Focus on weakest variables.\n\n${context}`,
      }],
    })

    const toolUse = message.content.find(b => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return NextResponse.json({ error: 'No structured response from AI' }, { status: 500 })
    }

    const input = toolUse.input as Record<string, unknown>

    await supabase.from('deal_rounds').update({
      briefing_line: input.line,
      briefing_read: input.read,
      briefing_angle: input.angle,
      briefing_win_condition: input.win_condition,
      briefing_questions: input.questions,
      briefing_mirror: input.mirror,
      briefing_objections: input.objections,
      briefing_do_not: input.do_not,
    }).eq('id', roundId)

    return NextResponse.json({ briefing: input })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown AI error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
