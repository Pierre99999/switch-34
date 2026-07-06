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
    system: `You are a sales intelligence engine updating a knowledge base after a prospect conversation.

CRITICAL RULE: Only write what is NEW in this round. Do NOT repeat, rephrase, or summarize information that already exists in previous entries. Each entry should add incremental value — a new fact, a changed signal, or a deeper understanding that wasn't there before. If nothing new emerged for a box in this round, return "" for it.

Here is what already exists in the knowledge base:
${existingBoxSummary || '(empty — first round)'}

For COLLECTED boxes (perception, problems, stakeholders, human_pain, budget): extract ONLY new information from this round's capture notes that wasn't captured before.

For BUILT boxes (buy_reason, implementation, urgency, value, timing, forces): synthesize ONLY new analytical insights from this round's scores and context. If your analysis hasn't changed from previous rounds, return "".

Be concise: 1-2 sentences per entry. Return "" if nothing new to add. Do not hallucinate specific facts not in the context.` + localeInstruction(locale),
    tools: [
      {
        name: 'update_boxes',
        description: 'Update knowledge boxes based on this round\'s capture and scores',
        input_schema: {
          type: 'object' as const,
          properties: {
            perception: { type: 'string', description: 'How the prospect perceives the vendor. Any signals about brand, reputation, or preconceptions from capture notes.' },
            problems: { type: 'string', description: "The prospect's real operational problems that emerged. Specific, in their words." },
            stakeholders: { type: 'string', description: 'Stakeholders or roles mentioned. Who is involved, who has influence, who is missing.' },
            human_pain: { type: 'string', description: 'Personal stakes — what individuals feel, fear, or want to avoid.' },
            budget: { type: 'string', description: 'Any signals about budget: existence, size, approval process, timing, constraints.' },
            buy_reason: { type: 'string', description: 'Why this prospect should buy — now. The strongest argument for action given scores and context.' },
            implementation: { type: 'string', description: 'How the solution fits into their specific reality based on what is known.' },
            urgency: { type: 'string', description: 'What makes this urgent — frequency, intensity, stakes — based on scores and context.' },
            value: { type: 'string', description: 'The minimum value this prospect needs to see to make a decision, based on their priorities.' },
            timing: { type: 'string', description: 'When a decision needs to happen and what is driving that timeline.' },
            forces: { type: 'string', description: 'Forces that accelerate, slow, or are ambivalent — based on stakeholder map and buying environment.' },
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
