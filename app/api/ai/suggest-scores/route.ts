import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildVendorContext, buildProspectContext, buildScoresContext, buildCaptureContext } from '@/lib/ai-context'
import { LAYER_VARIABLES, VARIABLE_LABELS, EVIDENCE_CAP, type EvidenceLevel } from '@/lib/types'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const { dealId, roundId } = await req.json()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: deal }, { data: round }, { data: vendor }, { data: allRounds }] = await Promise.all([
    supabase.from('deals').select('*').eq('id', dealId).single(),
    supabase.from('deal_rounds').select('*').eq('id', roundId).single(),
    supabase.from('vendors').select('*').eq('user_id', user.id).single(),
    supabase.from('deal_rounds').select('*').eq('deal_id', dealId).order('round', { ascending: true }),
  ])

  if (!deal || !round || !vendor) return NextResponse.json({ error: 'Data not found' }, { status: 404 })

  // Build all variable names for the schema
  const allVars = Object.values(LAYER_VARIABLES).flat() as string[]

  const suggestionProperties: Record<string, unknown> = {}
  for (const v of allVars) {
    suggestionProperties[v] = {
      type: 'object',
      properties: {
        score: { type: 'number', description: 'Suggested score 1-5. Will be capped by evidence level.' },
        evidence: { type: 'string', enum: ['declared', 'corroborated', 'verified'], description: 'declared = one person said it (cap 3), corroborated = multiple sources or repeated across rounds (cap 4), verified = hard data/documents/metrics shared (cap 5)' },
        rationale: { type: 'string', description: 'One sentence: what in the capture notes justifies this score AND evidence level' },
      },
      required: ['score', 'evidence', 'rationale'],
    }
  }

  const context = [
    buildVendorContext(vendor),
    buildProspectContext(deal),
    buildScoresContext(round),
    buildCaptureContext(allRounds ?? []),
  ].join('\n\n')

  const variableList = allVars.map(v => `${v}: ${VARIABLE_LABELS[v]}`).join('\n')

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are a sales diagnostic engine. Based on what was said in the conversation capture notes, suggest updated scores (1-5) for the 20 diagnostic variables.

EVIDENCE LEVELS — every score must include an evidence level that determines its maximum:
- "declared" (cap: 3/5) — one person stated it in one conversation. No corroboration, no proof. Most first-round information is declared.
- "corroborated" (cap: 4/5) — confirmed by multiple people, or the same person repeated it with more detail across rounds, or it's consistent with other verified facts.
- "verified" (cap: 5/5) — backed by hard data: numbers on a slide, a shared document, a metric, a contract clause, an org chart. The prospect showed proof, not just words.

RULES:
- If a variable was not addressed, keep the previous score and evidence level.
- A score CANNOT exceed its evidence cap. If you think the real score is 4 but the evidence is only "declared", score it 3.
- Be skeptical of first-round claims. One person saying "we have budget" is declared (max 3), not verified.
- Look at previous rounds' capture notes: if the same claim was made before AND confirmed again, upgrade to corroborated.
- Only mark "verified" when the capture notes explicitly mention data, documents, or metrics being shared.`,
    tools: [
      {
        name: 'suggest_scores',
        description: 'Suggest updated diagnostic scores based on capture notes',
        input_schema: {
          type: 'object' as const,
          properties: suggestionProperties,
          required: [],
        },
      },
    ],
    tool_choice: { type: 'any' as const },
    messages: [{
      role: 'user',
      content: `Review the capture notes from round ${round.round} and suggest updated scores for all 19 variables.\n\nVariables:\n${variableList}\n\n${context}`,
    }],
  })

  const toolUse = message.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return NextResponse.json({ error: 'No structured response from AI' }, { status: 500 })
  }

  // Apply evidence caps to all suggested scores
  const raw = toolUse.input as Record<string, { score: number; evidence: EvidenceLevel; rationale: string }>
  const capped: Record<string, { score: number; evidence: EvidenceLevel; rationale: string }> = {}
  for (const [variable, suggestion] of Object.entries(raw)) {
    const ev = suggestion.evidence ?? 'declared'
    const cap = EVIDENCE_CAP[ev] ?? 3
    capped[variable] = {
      ...suggestion,
      evidence: ev,
      score: suggestion.score !== null ? Math.min(suggestion.score, cap) : suggestion.score,
    }
  }

  return NextResponse.json({ suggestions: capped })
}
