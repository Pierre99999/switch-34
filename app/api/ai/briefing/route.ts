import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildVendorContext, buildProspectContext, buildScoresContext, buildCaptureContext } from '@/lib/ai-context'
import { LAYER_VARIABLES, LAYER_LABELS, type DealRound } from '@/lib/types'
import { localeInstruction } from '@/lib/ai-locale'

const client = new Anthropic()

// Determine the active diagnostic layer — the first that is NOT solid.
// A layer is solid when ALL its variables are scored AND the average >= 3.0.
// This enforces sequential progression: L1 must be solid before L2 gets focus.
function getActiveLayer(round: DealRound): number {
  for (const layer of [1, 2, 3, 4]) {
    const vars = LAYER_VARIABLES[layer as keyof typeof LAYER_VARIABLES]
    const scores = vars.map(v => round[v as keyof DealRound] as number | null)
    const filled = scores.filter(s => s !== null) as number[]
    if (filled.length < vars.length) return layer  // not all variables scored
    const avg = filled.reduce((a, b) => a + b, 0) / filled.length
    if (avg < 3.0) return layer                    // scored but weak
  }
  return 4 // all solid, stay on momentum
}

const LAYER_GATE: Record<number, string> = {
  1: 'Stay or not? — Establish whether a real business problem exists, that personal pain is present, that our terrain fits, and who the real stakeholders are. Nothing else matters until this layer is solid.',
  2: 'Can we win? — Establish our credibility in their eyes, validate the value/solution fit, understand urgency and competitive position. Only probe this once Layer 1 is confirmed.',
  3: 'Is there impact? — Establish that our product can actually deliver, that implementation is feasible, adoption is realistic, and the impact is tangible. Only relevant after Layers 1–2 are solid.',
  4: 'What forces govern the decision? — Map the forces that accelerate, slow, or remain ambivalent. Understand strategic alignment, internal momentum, open objections, and friction. The final diagnostic layer.',
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

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

  if (!deal || !round) return NextResponse.json({ error: 'Data not found' }, { status: 404 })

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
    max_tokens: 8192,
    system: `You are a senior sales coach generating a pre-conversation briefing based on the French diagnostic sales methodology from Pierre Gaubil's book "Pourquoi les meilleurs vendeurs ne vendent pas".

The methodology has four sequential diagnostic layers — they must be built in order:
  Layer 1 · Opportunity: Stay or not? Real business problem, personal pain linkage, terrain fit, stakeholder map.
  Layer 2 · Winability: Can we win? Credibility/perception, value-solution fit, competitive position, urgency.
  Layer 3 · Impact: Is there real impact? Product capability, implementation feasibility, adoption reality, tangible impact.
  Layer 4 · Momentum: Decision forces — what accelerates, slows, or is ambivalent.

The ACTIVE LAYER for this round is Layer ${activeLayer} — ${activeLayerLabel}.
Gate question: ${gateDescription}

Question generation rules:
- Generate exactly 4 PRESSING questions for Layer ${activeLayer}. Fewer, deeper — not a checklist.
- Generate exactly 2 OPPORTUNISTIC questions spread across higher layers (${opportunisticDesc}). Only if the conversation naturally opens there.
- Maximum 6 questions total. If you feel the urge to write more, cut the weakest ones.
- Each question has ONE main question (open, natural) and 2–3 sub-questions (probes to go deeper on the same thread).
- The intent explains what the main question is trying to establish — one sentence, for the seller's eyes only.
- Opportunistic questions can target ANY higher layer — if you sense an opening for L4 signals (internal momentum, objections, process drag), go for it.
- Questions must sound like a human conversation, never a form or an interrogation.

Be specific — reference actual prospect details, actual scores, actual capture notes. No generic coaching advice.` + localeInstruction(locale),
    tools: [
      {
        name: 'save_briefing',
        description: 'Save the generated briefing for this deal round',
        input_schema: {
          type: 'object' as const,
          properties: {
            line: { type: 'string', description: `One sentence framing the entire conversation — what the active layer (L${activeLayer}: ${activeLayerLabel}) needs to resolve.` },
            read: { type: 'string', description: 'Where the deal stands honestly. What you know, what is missing, what the scores reveal. 3–5 sentences.' },
            angle: { type: 'string', description: 'What needs to be accomplished in this conversation — the diagnostic objective stated plainly. Not a posture description but a clear statement of what must be resolved: "Establish whether X is true, confirm that Y exists, determine if Z is real." 3–5 sentences.' },
            win_condition: { type: 'string', description: `What would make this conversation a success for Layer ${activeLayer}. Be specific.` },
            questions: {
              type: 'array',
              description: `4 pressing questions for Layer ${activeLayer}, then 2 opportunistic questions across higher layers (${opportunisticDesc}). Maximum 6 questions total. Each question has sub-questions to probe deeper if the main question opens a thread.`,
              items: {
                type: 'object',
                properties: {
                  layer: { type: 'number', description: 'Layer number (1–4)' },
                  variable: { type: 'string', description: 'The score variable this question targets' },
                  intent: { type: 'string', description: 'One sentence: what this question is trying to establish or diagnose. The seller reads this, not the prospect.' },
                  text: { type: 'string', description: 'The single main question to ask — open, conversational, non-leading.' },
                  sub_questions: { type: 'array', items: { type: 'string' }, description: '2–3 follow-up probes to use if the main question opens a thread. Short, natural, each targeting a deeper dimension of the same variable.' },
                  priority: { type: 'string', enum: ['pressing', 'opportunistic'], description: `pressing = Layer ${activeLayer} (must ask this round), opportunistic = any higher layer (only if the door opens naturally)` },
                },
                required: ['layer', 'variable', 'intent', 'text', 'sub_questions', 'priority'],
              },
            },
            mirror: {
              type: 'array',
              description: "Exact words or phrases from the prospect's capture notes to echo back.",
              items: { type: 'string' },
            },
            objections: {
              type: 'array',
              description: 'Likely objections to prepare for, given the active layer focus.',
              items: {
                type: 'object',
                properties: {
                  likely: { type: 'string', description: 'The objection as the prospect would voice it.' },
                  frame: { type: 'string', description: 'How to reframe or respond.' },
                },
                required: ['likely', 'frame'],
              },
            },
            do_not: {
              type: 'array',
              description: 'Things to avoid in this conversation given the deal state and active layer.',
              items: { type: 'string' },
            },
          },
          required: ['line', 'read', 'angle', 'win_condition', 'questions', 'mirror', 'objections', 'do_not'],
        },
      },
    ],
    tool_choice: { type: 'any' as const },
    messages: [{
      role: 'user',
      content: `Generate the briefing for round ${round.round}. Active diagnostic layer: Layer ${activeLayer} (${activeLayerLabel}). Focus pressing questions on the weakest scored variables within this layer. Use specific details from capture notes for mirror terms.\n\n${context}`,
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
}
