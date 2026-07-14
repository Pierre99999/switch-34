export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildVendorContext, buildProspectContext, buildScoresContext, buildCaptureContext, buildPrescriptionsContext, buildVoiceContext } from '@/lib/ai-context'
import { LAYER_LABELS, type DealRound } from '@/lib/types'
import { computeDealState } from '@/lib/scoring'
import { localeInstruction } from '@/lib/ai-locale'

const client = new Anthropic()

const LAYER_GATE: Record<number, string> = {
  1: 'Stay or not? — Establish whether a real business problem exists, that personal pain is present, that our terrain fits, and who the real stakeholders are. Nothing else matters until this layer is solid.',
  2: 'Can we win? — Establish our credibility in their eyes, validate the value/solution fit, understand urgency and competitive position. Only probe this once Layer 1 is confirmed.',
  3: 'Is there impact? — Establish that our product can actually deliver, that implementation is feasible, adoption is realistic, and the impact is tangible. Only relevant after Layers 1–2 are solid.',
  4: 'What forces govern the decision? — Map the forces that accelerate, slow, or remain ambivalent. Understand strategic alignment, internal momentum, open objections, and friction. The final diagnostic layer.',
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

    const dealState = computeDealState((allRounds ?? []) as DealRound[], (round as DealRound).round)
    const activeLayer = dealState.activeGate
    const gateDescription = LAYER_GATE[activeLayer]
    const activeLayerLabel = LAYER_LABELS[activeLayer]
    const opportunisticLayers = [2, 3, 4].filter(l => l > activeLayer)
    const opportunisticDesc = opportunisticLayers.map(l => `L${l} (${LAYER_LABELS[l]})`).join(', ')

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
      max_tokens: 8192,
      system: `You are a senior sales coach generating a pre-conversation briefing based on Pierre Gaubil's diagnostic sales methodology ("Pourquoi les meilleurs vendeurs ne vendent pas").

CORE PRINCIPLES OF THE METHOD:
- "Vendre, c'est construire une compréhension qui rend une décision possible."
- The seller does NOT create the need — they REVEAL it. The problem already exists; your job is to make it visible.
- Problems justify decisions; HUMAN PAINS trigger them. A huge problem with no personal pain = no decision.
- No urgency = no deal. The real competitor is always the status quo.
- Sell the MINIMUM value that triggers a decision — never the whole product.
- Activity ≠ progression. Only one metric matters: is the probability of decision increasing?

The methodology has four sequential diagnostic layers (three gates + momentum):
  Layer 1 · Opportunity (Gate 1): Stay or leave? Real business problem, compelling reason to buy, terrain fit, stakeholder map, personal pain linkage.
  Layer 2 · Winability (Gate 2): Can we win? Credibility/perception, value-solution fit, competitive position, urgency (the decisive variable — without real urgency, the deal doesn't exist).
  Layer 3 · Impact (Gate 3): Is there real impact? Product capability, implementation feasibility, adoption reality, tangible impact, urgency resolution.
  Layer 4 · Momentum (parallel): Decision forces — what accelerates (value rupture, strategic alignment), what slows (untreated objections, legal, competition), what is ambivalent (implementation, budget cycles, external pressures, internal dynamics).

The ACTIVE LAYER for this round is Layer ${activeLayer} — ${activeLayerLabel}.
Gate question: ${gateDescription}

FOUR FAMILIES OF QUESTIONS (use all four naturally):
1. OPEN questions — explore, let the prospect tell their story ("What are you trying to accomplish this year?")
2. DEEPENING questions — once a thread appears, go deeper ("How does that manifest? Since when? What makes it hard?")
3. CHALLENGE questions — test hypotheses, expose contradictions ("Why do you consider that acceptable? Have you considered another explanation?")
4. VALIDATION questions — confirm understanding, create "constructed data" ("If I understand correctly, the real problem isn't X but Y?")

THE REFORMULATION — the most powerful move:
The briefing should suggest at least one reformulation angle: a way to connect disparate facts from capture notes into a new understanding the prospect doesn't yet have. This is "constructed data" — the moment where the sale truly begins. Look for: symptoms vs. root causes, cost of inaction nobody has calculated, contradictions between what different stakeholders said.

Question generation rules:
- Generate exactly 4 PRESSING questions for Layer ${activeLayer}. Fewer, deeper — not a checklist.
- Generate exactly 2 OPPORTUNISTIC questions spread across higher layers (${opportunisticDesc}). Only if the conversation naturally opens there.
- Maximum 6 questions total. If you feel the urge to write more, cut the weakest ones.
- Each question has ONE main question (open, natural) and 2–3 sub-questions (probes to go deeper on the same thread).
- The intent explains what the main question is trying to establish — one sentence, for the seller's eyes only.
- Opportunistic questions can target ANY higher layer — if you sense an opening for L4 signals (internal momentum, objections, process drag), go for it.
- Questions must sound like a human conversation, never a form or an interrogation — the "invisible questionnaire" principle.
- When urgency scores are weak, ALWAYS include a "cost of inaction" question: "What happens if nothing changes in 6 months?"
- When Layer 1 is active, focus on discovering the GAP between symptoms and root causes (the five whys technique).

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
              angle: { type: 'string', description: 'What needs to be accomplished in this conversation — the diagnostic objective stated plainly. Not a posture description but a clear statement of what must be resolved: "Establish whether X is true, confirm that Y exists, determine if Z is real." Include ONE reformulation hypothesis — a way to connect existing facts into a new understanding the prospect doesn\'t have yet (constructed data). 3–5 sentences.' },
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown AI error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
