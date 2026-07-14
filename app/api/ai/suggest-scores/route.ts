export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildVendorContext, buildProspectContext, buildScoresContext, buildCaptureContext } from '@/lib/ai-context'
import { LAYER_VARIABLES, VARIABLE_LABELS, type EvidenceLevel, type SourceAuthority } from '@/lib/types'
import { localeInstruction } from '@/lib/ai-locale'

const client = new Anthropic()

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
    supabase.from('vendors').select('*').eq('user_id', user.id).single(),
    supabase.from('deal_rounds').select('*').eq('deal_id', dealId).order('round', { ascending: true }),
  ])

  if (!deal || !round || !vendor) return NextResponse.json({ error: 'Data not found' }, { status: 404 })

  // Determine which variables were actually discussed based on capture notes
  const captureNotes = (round.capture_notes ?? {}) as Record<string, string>
  const briefingQuestions = (round.briefing_questions ?? []) as Array<{ variable: string; text: string }>
  const answeredVariables = new Set<string>()
  for (const q of briefingQuestions) {
    const noteKey = q.text
    if (noteKey && captureNotes[noteKey]?.trim()) {
      if (q.variable) answeredVariables.add(q.variable)
    }
  }
  const hasFreeNotes = !!captureNotes.__free__?.trim()

  // Build all variable names for the schema
  const allVars = Object.values(LAYER_VARIABLES).flat() as string[]

  const suggestionProperties: Record<string, unknown> = {}
  for (const v of allVars) {
    suggestionProperties[v] = {
      type: 'object',
      properties: {
        score: { type: 'number', description: 'Raw signal S (0-5): 5 explicit and precise, 4 favorable concrete, 3 favorable vague, 2 ambiguous, 1 unfavorable. The engine caps it by evidence.' },
        evidence: { type: 'string', enum: ['declared', 'corroborated', 'verified'], description: 'declared = one person said it (caps at 2.5), corroborated = multiple independent sources (caps at 4), verified = CHIFFRÉ, validated by data: amounts, dates, volumes, contracts (up to 5)' },
        authority: { type: 'string', enum: ['decision_maker', 'influencer', 'end_user'], description: 'Who provided this information: decision_maker = C-level/VP/budget owner, influencer = manager/champion/recommender, end_user = individual contributor/user. Used for the legitimate-actor rule.' },
        rationale: { type: 'string', description: 'One sentence: what in the capture notes justifies this score AND evidence level' },
      },
      required: ['score', 'evidence', 'authority', 'rationale'],
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
    max_tokens: 4096,
    system: `You are a sales diagnostic engine based on Pierre Gaubil's Switch methodology. Based on what was said in the conversation capture notes, suggest updated scores (1-5) for the diagnostic variables.

METHODOLOGY CONTEXT:
- Layer 1 (Opportunity): Does a real business problem exist? Is there personal pain? Does it fit our terrain?
- Layer 2 (Winability): Do they see us as credible? Does our value fit? Is there REAL urgency?
- Layer 3 (Impact): Can the product deliver? Is implementation feasible? Will users adopt?
- Layer 4 (Momentum): Are decision forces converging or diverging?

URGENCY SCORING — the most critical variable. Score urgency using the 7-dimension matrix:
  1. Frequency: How often does the problem recur?
  2. Intensity: How severe is each occurrence (stress, friction, cost)?
  3. Spectrum: How many people/departments/levels are affected?
  4. Financial impact: What is the measurable cost of inaction?
  5. Strategic impact: Does it compromise a key initiative or competitive position?
  6. Client impact: Does it degrade customer satisfaction, support load, retention?
  7. Risk: Legal exposure, latent vulnerability, or reputation risk?
A score of 4-5 requires multiple dimensions "lit up" with evidence. A single dimension = max 2-3.

PERSONAL PAIN LINKAGE — score based on:
  - Are specific individuals identified who PERSONALLY suffer (career risk, reputation, stress, blocked ambition)?
  - Remember: "Les problèmes créent les projets; les douleurs créent les décisions." A big company problem with no personal pain = low score.

COMPELLING REASON — score based on:
  - Is there a legitimate reason to buy NOW (not just interest)?
  - A legitimate reason requires: real problem + consequences + visibility + justification for change.
  - "Interested" or "curious" = 1-2. "Must solve this or face consequences" = 4-5.

SIGNAL S — the score you give is the raw SIGNAL (0-5): is what was said favorable to the deal?
  5 = explicit and precise · 4 = favorable and concrete · 3 = favorable but vague/partial · 2 = ambiguous/contradictory · 1 = unfavorable · 0 = nothing.

EVIDENCE LEVELS — every score must include an evidence level. The proof CAPS the final score (applied by the engine), it never boosts it:
- "declared" (caps at 2.5/5) — one person stated it in one conversation. No corroboration, no proof. Most first-round information is declared. Exception: if the declarant is the natural owner of the dimension (budget owner on budget, end users on adoption, technical team on implementation, the person concerned on personal pain), the cap is 4.0.
- "corroborated" (caps at 4.0/5) — confirmed by multiple INDEPENDENT sources.
- "verified" (caps at 5/5) — CHIFFRÉ: validated by data — amounts, dates, volumes, contracts, metrics shared.

SOURCE AUTHORITY — who provided the information (used for the legitimate-actor rule):
- "decision_maker" — CEO, VP, budget owner, final decision maker.
- "influencer" — Manager, champion, technical lead, recommender.
- "end_user" — Individual contributor, user, operator.

RULES:
- ONLY score variables that were explicitly addressed in the capture notes. If a variable was NOT discussed, DO NOT include it in your response — omit it entirely.
- Report the raw signal S honestly — the engine applies the evidence caps automatically.
- Be skeptical of first-round claims. One person saying "we have budget" is declared, not verified.
- Look at previous rounds' capture notes: if the same claim was made before AND confirmed again, upgrade to corroborated.
- Only mark "verified" when the capture notes explicitly mention data, documents, or metrics being shared.
- Determine source authority from context: if the capture notes mention who said something (CEO, manager, user), set authority accordingly. Default to "end_user" if unclear.
- It is BETTER to leave a variable unscored than to guess. Only score what you have evidence for.
- Be especially rigorous on urgency, compelling_reason, and personal_pain_linkage — these are the three variables that determine if a deal is real.` + localeInstruction(locale),
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

  // Apply evidence caps and filter to only variables with actual capture evidence
  const raw = toolUse.input as Record<string, { score: number; evidence: EvidenceLevel; authority: SourceAuthority; rationale: string }>
  const capped: Record<string, { score: number; evidence: EvidenceLevel; authority: SourceAuthority; rationale: string }> = {}
  for (const [variable, suggestion] of Object.entries(raw)) {
    if (!hasFreeNotes && answeredVariables.size > 0 && !answeredVariables.has(variable)) continue
    const ev = suggestion.evidence ?? 'declared'
    const auth = suggestion.authority ?? 'end_user'
    // Store the raw signal S (integer 0-5). Evidence caps are applied at
    // computation time by lib/scoring.ts — the proof caps, it never boosts.
    capped[variable] = {
      ...suggestion,
      evidence: ev,
      authority: auth,
    }
  }

  return NextResponse.json({ suggestions: capped })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown AI error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
