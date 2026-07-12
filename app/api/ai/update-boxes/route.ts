export const runtime = 'edge'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildVendorContext, buildProspectContext, buildScoresContext, buildCaptureContext } from '@/lib/ai-context'
import { localeInstruction } from '@/lib/ai-locale'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const { dealId, roundId, locale } = await req.json()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: deal }, { data: round }, { data: vendor }, { data: allRounds }, { data: existingBoxes }] = await Promise.all([
    supabase.from('deals').select('*').eq('id', dealId).single(),
    supabase.from('deal_rounds').select('*').eq('id', roundId).single(),
    supabase.from('vendors').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('deal_rounds').select('*').eq('deal_id', dealId).order('round', { ascending: true }),
    supabase.from('deal_boxes').select('*').eq('deal_id', dealId),
  ])

  if (!deal || !round) return NextResponse.json({ error: 'Deal or round not found' }, { status: 404 })

  // Check if any round has capture notes (not just the passed round)
  const hasCapture = (allRounds ?? []).some(r => {
    const notes = r.capture_notes as Record<string, string> | null
    return notes && Object.values(notes).some(v => typeof v === 'string' && v.trim())
  })

  const contextParts: string[] = []
  if (vendor) contextParts.push(buildVendorContext(vendor))
  contextParts.push(buildProspectContext(deal))
  contextParts.push(buildScoresContext(round))
  contextParts.push(buildCaptureContext(allRounds ?? []))
  const context = contextParts.join('\n\n')

  // Always try to update built boxes from scores; skip collected if no capture
  const hasScores = Object.values(round).some(v => typeof v === 'number' && v > 0)

  if (!hasCapture && !hasScores) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'no capture notes and no scores yet' })
  }

  const BOX_MAP: Record<string, string> = {
    perception: 'perception',
    problems: 'problems',
    stakeholders: 'stakeholders',
    human_pain: 'human-pain',
    budget: 'budget',
    buy_reason: 'buy-reason',
    implementation: 'implementation',
    urgency: 'urgency',
    value: 'value',
    timing: 'timing',
    forces: 'forces',
  }

  // Build summary of existing box entries to pass to AI
  const existingBoxSummary = Object.entries(BOX_MAP).map(([toolKey, boxId]) => {
    const entries = (existingBoxes ?? []).find(b => b.box_id === boxId)?.entries as { round: number; text: string }[] | undefined
    if (!entries?.length) return null
    const lines = entries.map(e => `  R${e.round}: ${e.text}`).join('\n')
    return `${toolKey}:\n${lines}`
  }).filter(Boolean).join('\n\n')

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: `You are a sales intelligence engine based on Pierre Gaubil's Switch methodology, updating a knowledge base after a prospect conversation.

METHODOLOGY FRAMEWORK — the four types of data:
1. PERCEPTION data: how they see us before we even speak
2. SELF-KNOWLEDGE data: what we know about our own strengths (pre-filled)
3. DISCOVERY data: what we learn from the prospect (problems, actors, pains, budget)
4. CONSTRUCTED data: insights WE build by connecting everything else — this is what separates good from great

CRITICAL RULE: Only write what is NEW in this round. Do NOT repeat, rephrase, or summarize information that already exists in previous entries. Each entry should add incremental value — a new fact, a changed signal, or a deeper understanding that wasn't there before. If nothing new emerged for a box in this round, return "" for it.

Here is what already exists in the knowledge base:
${existingBoxSummary || '(empty — first round)'}

For COLLECTED boxes (perception, problems, stakeholders, human_pain, budget): extract ONLY new information from this round's capture notes that wasn't captured before.
- problems: distinguish SYMPTOMS from ROOT CAUSES. If the prospect describes a symptom, note it but flag it as such.
- stakeholders: identify the FIVE ACTOR TYPES when possible: champion (acts when you're not there), user (lives with it daily), technical buyer (seeks reasons to say no), decision-maker (can say yes), blocker (protects something).
- human_pain: focus on what individuals PERSONALLY risk or hope to gain — career, reputation, stress, ambition, recognition. "The company loses money" is a problem; "the VP loses his credibility" is a pain.

For BUILT boxes (buy_reason, implementation, urgency, value, timing, forces): synthesize ONLY new analytical insights from this round's scores and context. If your analysis hasn't changed from previous rounds, return "".
- buy_reason: state the LEGITIMATE REASON TO BUY — not interest, not curiosity, but why they MUST act. Include cost of inaction if known.
- urgency: qualify across the 7 dimensions (frequency, intensity, spectrum of people affected, financial/strategic/client impact, risk). State which dimensions are "lit" and which remain dark.
- value: express as the MINIMUM VALUE that triggers the decision — not everything the product does, but the one consequence that matters most to the decision-maker.
- forces: explicitly categorize into ACCELERATING (value rupture, strategic initiative alignment), BRAKING (untreated objections, legal friction, cheaper competition), and AMBIVALENT (implementation complexity, budget cycle timing, external pressures, champion strength). State whether forces are converging or diverging.
- timing: link to a concrete event or deadline. "Soon" is not timing; "before the Q3 board meeting" is.

Be concise: 1-3 sentences per entry. Return "" if nothing new to add. Do not hallucinate specific facts not in the context.` + localeInstruction(locale),
    tools: [
      {
        name: 'update_boxes',
        description: 'Update knowledge boxes based on this round\'s capture and scores',
        input_schema: {
          type: 'object' as const,
          properties: {
            perception: { type: 'string', description: 'How the prospect perceives us: credible peer or mere vendor? Signals about trust, brand, reputation, or preconceptions.' },
            problems: { type: 'string', description: "Business problems — distinguish symptoms from root causes. Use their words. Flag if we've only heard symptoms, not the underlying cause." },
            stakeholders: { type: 'string', description: 'Actor map: champion (acts for us internally), user, technical buyer, decision-maker, blocker. Note who is missing from the map.' },
            human_pain: { type: 'string', description: 'Personal pain per individual — what they personally lose (career, credibility, stress) or gain (promotion, recognition, autonomy). Not company problems.' },
            budget: { type: 'string', description: 'Budget signals. Remember: a budget is a consequence, not a cause. Note if the REASON to create budget exists even if the line item does not.' },
            buy_reason: { type: 'string', description: 'The legitimate reason to buy NOW — a problem grave enough to justify a decision, with visible consequences and time pressure. Not interest — necessity.' },
            implementation: { type: 'string', description: 'Can we deploy without friction? Who pilots client-side? Is it a big-bang or a scoped first step? Think implementation early — not after the contract.' },
            urgency: { type: 'string', description: 'Urgency qualified on 7 dimensions: frequency, intensity, spectrum, financial/strategic/client impact, risk. Which are lit? Which are dark?' },
            value: { type: 'string', description: 'The MINIMUM value that triggers the decision — not everything we do, but the one impact that matters to the decision-maker. Express as consequence, not feature.' },
            timing: { type: 'string', description: 'Concrete deadline or event driving the timeline. A deal without a calendar is a deal that stretches indefinitely.' },
            forces: { type: 'string', description: 'Decision forces: ACCELERATING (value rupture, strategic alignment), BRAKING (objections, legal, competition), AMBIVALENT (implementation, budget cycle, external pressure, champion strength). Are they converging?' },
          },
          required: ['perception', 'problems', 'stakeholders', 'human_pain', 'budget', 'buy_reason', 'implementation', 'urgency', 'value', 'timing', 'forces'],
        },
      },
    ],
    tool_choice: { type: 'any' as const },
    messages: [{
      role: 'user',
      content: `Update knowledge boxes for round ${round.round}.\n\n${context}`,
    }],
  })

  const toolUse = message.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return NextResponse.json({ error: 'No structured response from AI' }, { status: 500 })
  }

  const input = toolUse.input as Record<string, string>
  // Build existing entries map
  const existingMap: Record<string, { round: number; text: string }[]> = {}
  for (const row of existingBoxes ?? []) {
    existingMap[row.box_id] = row.entries ?? []
  }

  // Upsert each box that has new content
  const errors: string[] = []
  for (const [toolKey, boxId] of Object.entries(BOX_MAP)) {
    const text = input[toolKey]?.trim()
    if (!text) continue

    // Skip collected boxes if there were no capture notes
    const isCollected = ['perception', 'problems', 'stakeholders', 'human_pain', 'budget'].includes(toolKey)
    if (isCollected && !hasCapture) continue

    const prev = existingMap[boxId] ?? []
    // Replace existing entry for this round, or append if new
    const newEntries = prev.some(e => e.round === round.round)
      ? prev.map(e => e.round === round.round ? { round: e.round, text } : e)
      : [...prev, { round: round.round, text }]

    const { error } = await supabase
      .from('deal_boxes')
      .upsert({ deal_id: dealId, box_id: boxId, entries: newEntries }, { onConflict: 'deal_id,box_id' })

    if (error) errors.push(`${boxId}: ${error.message}`)
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
