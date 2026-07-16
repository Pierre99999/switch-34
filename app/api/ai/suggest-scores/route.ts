export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildVendorContext, buildProspectContext, buildScoresContext, buildCaptureContext } from '@/lib/ai-context'
import { LAYER_VARIABLES, VARIABLE_LABELS, type EvidenceLevel } from '@/lib/types'
import { evidenceFromDeclarations, type Declaration } from '@/lib/voice-credit'
import { ACTOR_TYPE_TO_ROLE, type ActorRole } from '@/lib/voice-weights'
import { localeInstruction } from '@/lib/ai-locale'
import { recordUsage } from '@/lib/ai-usage'

const client = new Anthropic()

const ROLES: ActorRole[] = ['decideur', 'champion', 'acheteur_technique', 'gardien_du_budget', 'utilisateur', 'bloqueur', 'unknown']

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  try {
  const { dealId, roundId, locale } = await req.json()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: deal }, { data: round }, { data: vendor }, { data: allRounds }, { data: stakeholders }] = await Promise.all([
    supabase.from('deals').select('*').eq('id', dealId).single(),
    supabase.from('deal_rounds').select('*').eq('id', roundId).single(),
    supabase.from('vendors').select('*').eq('user_id', user.id).single(),
    supabase.from('deal_rounds').select('*').eq('deal_id', dealId).order('round', { ascending: true }),
    supabase.from('deal_stakeholders').select('name, role, actor_type, actor_types').eq('deal_id', dealId),
  ])

  if (!deal || !round || !vendor) return NextResponse.json({ error: 'Data not found' }, { status: 404 })

  const allVars = Object.values(LAYER_VARIABLES).flat() as string[]

  // Map known stakeholders to canonical roles so the AI can attach the right
  // voice. A person can wear several hats — list them all so the AI picks the
  // one that fits each statement.
  const stakeholderList = (stakeholders ?? []).map(s => {
    const types = (s.actor_types && s.actor_types.length ? s.actor_types : [s.actor_type ?? 'unknown']) as string[]
    const roles = [...new Set(types.map(t => ACTOR_TYPE_TO_ROLE[t] ?? 'unknown'))]
    return `- ${s.name}${s.role ? ` (${s.role})` : ''} → roles: ${roles.join(', ')}`
  }).join('\n') || '(no stakeholders mapped yet — use role "unknown" when the speaker is unqualified)'

  const suggestionProperties: Record<string, unknown> = {}
  for (const v of allVars) {
    suggestionProperties[v] = {
      type: 'object',
      properties: {
        score: { type: 'number', description: 'Raw signal S (0-5): 5 explicit and precise, 4 favorable concrete, 3 favorable vague, 2 ambiguous/contradictory, 1 unfavorable. The engine caps it by the computed evidence level.' },
        declarations: {
          type: 'array',
          description: 'One entry per person who spoke to this criterion in the capture notes. The engine computes the evidence level (declared/corroborated) from these via a role-weighted voice credit.',
          items: {
            type: 'object',
            properties: {
              contact: { type: 'string', description: 'Name of the person who said it (as it appears in the notes/stakeholders). Empty if truly unknown.' },
              role: { type: 'string', enum: ROLES, description: 'Canonical role of the speaker, taken from the stakeholder map. Use "unknown" if the speaker is not qualified.' },
              stance: { type: 'string', enum: ['pour', 'contre', 'neutre'], description: 'Stance toward the deal on THIS criterion. "contre" ONLY if the person explicitly expresses doubt, opposition, or an unfavorable fact. A statement of alignment, fit, or a positive fact is "pour", never "contre". If purely factual/ambiguous, use "neutre". Do not mark "contre" just because the score is moderate.' },
              owner: { type: 'boolean', description: 'True only for self-referential criteria (personal pain, own perception) when the speaker talks about themselves.' },
              quantified: { type: 'boolean', description: 'True if backed by hard data: amounts, dates, volumes, contracts, metrics.' },
              text: { type: 'string', description: 'Short quote or paraphrase of what this person said.' },
            },
            required: ['role', 'stance', 'text'],
          },
        },
        rationale: { type: 'string', description: 'One sentence: what in the capture notes justifies this signal.' },
      },
      required: ['score', 'declarations', 'rationale'],
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
    max_tokens: 8192,
    system: `You are a sales diagnostic engine based on Pierre Gaubil's Switch methodology. From the captured conversation, score the diagnostic criteria AND attribute each statement to the person who made it.

METHODOLOGY CONTEXT:
- Gate 1 (Opportunity): Does a real business problem exist? Is there personal pain? Does it fit our terrain?
- Gate 2 (Winning): Do they see us as credible? Does our value fit? Is there REAL urgency?
- Gate 3 (Impact): Can the product deliver? Is implementation feasible? Will users adopt?
- Momentum (parallel): Are decision forces converging or diverging?

SIGNAL S — the score you give is the raw SIGNAL (0-5): is what was said favorable to the deal on this criterion?
  5 = explicit and precise · 4 = favorable and concrete · 3 = favorable but vague/partial · 2 = ambiguous/contradictory · 1 = unfavorable · 0 = nothing.

VOICE ATTRIBUTION — for every criterion you score, list the DECLARATIONS: who said what.
- Attribute each statement to a person and their canonical role from the stakeholder map below. A person may have several roles — pick the ONE that fits the statement (e.g. use "gardien_du_budget" when they speak about budget, "utilisateur" when they speak about daily use).
- Set "stance" from the deal's point of view: pour (favorable), contre (unfavorable), neutre. Use "contre" ONLY for explicit doubt/opposition/unfavorable facts — a positive alignment statement is "pour". A moderate score does not make a statement "contre".
- Set "quantified": true only when the statement is backed by hard data (amounts, dates, volumes, contracts).
- Set "owner": true only on self-referential criteria (personal_pain_linkage, credibility_perception) when the person speaks about their own pain or their own perception.
- Do NOT compute the evidence level yourself — the engine derives it from the declarations. Just report who said what, honestly.
- A single champion's enthusiasm is only "declared". A blocker conceding a favorable point is heavy. Report the raw stances; the weighting is automatic.

STAKEHOLDERS (name → role):
${stakeholderList}

URGENCY — the decisive criterion. Consider frequency, intensity, spread, financial/strategic/client impact, risk. A 4-5 requires multiple dimensions lit up.
PERSONAL PAIN — specific individuals who PERSONALLY suffer (career, reputation, stress). Company problem with no personal pain = low.
COMPELLING REASON — a legitimate reason to act NOW: real problem + consequences + visibility + justification.

RULES:
- ONLY score criteria explicitly addressed in the capture notes. Omit the rest entirely.
- Report the raw signal S honestly — the engine applies evidence caps automatically.
- It is BETTER to leave a criterion unscored than to guess.` + localeInstruction(locale),
    tools: [
      {
        name: 'suggest_scores',
        description: 'Score criteria and attribute each statement to its speaker',
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
      content: `Review the capture notes from round ${round.round}, score the criteria, and attribute each statement.\n\nVariables:\n${variableList}\n\n${context}`,
    }],
  })

  if (user) await recordUsage(supabase, { userId: user.id, route: 'ai/suggest-scores', model: 'claude-sonnet-4-6', usage: message.usage, dealId: dealId })

  const toolUse = message.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return NextResponse.json({ error: 'No structured response from AI' }, { status: 500 })
  }

  type AiSuggestion = { score: number; declarations: Declaration[]; rationale: string }
  const raw = toolUse.input as Record<string, AiSuggestion>

  const suggestions: Record<string, {
    score: number
    evidence: EvidenceLevel
    declarations: Declaration[]
    rationale: string
  }> = {}
  const alarms: { role: string; variable: string }[] = []
  const prescriptions: string[] = []

  for (const [variable, suggestion] of Object.entries(raw)) {
    const declarations = Array.isArray(suggestion.declarations) ? suggestion.declarations : []
    const voice = evidenceFromDeclarations(variable, declarations)
    // No declarations → keep the AI's signal but default to declared evidence.
    const evidence: EvidenceLevel = voice.level ?? 'declared'
    // A heavy contradiction forces the signal to ambiguous (S <= 2).
    const score = voice.forceMaxSignal !== null ? Math.min(suggestion.score, voice.forceMaxSignal) : suggestion.score
    suggestions[variable] = { score, evidence, declarations, rationale: suggestion.rationale }
    for (const a of voice.alarms) alarms.push(a)
    for (const p of voice.prescriptions) prescriptions.push(p)
  }

  return NextResponse.json({ suggestions, alarms, prescriptions })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown AI error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
