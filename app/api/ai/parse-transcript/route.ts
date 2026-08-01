export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { localeInstruction } from '@/lib/ai-locale'
import { LAYER_VARIABLES, VARIABLE_LABELS } from '@/lib/types'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  // Most transcripts arrive as a paste from Gong/Teams/Meet rather than a
  // file; requiring a download first was friction for nothing.
  const pasted = (formData.get('text') as string | null)?.trim() ?? ''
  const questionsJson = formData.get('questions') as string | null
  const locale = formData.get('locale') as string | null

  if (!file && !pasted) return NextResponse.json({ error: 'No transcript provided' }, { status: 400 })

  // A conversation that happened before the deal was in Switch has no briefing
  // to map against. Fall back to the diagnostic criteria themselves, so an
  // already-running deal can still be brought in from its transcripts.
  const questions: { key: string; variable: string; text: string; intent?: string }[] = questionsJson
    ? JSON.parse(questionsJson)
    : (Object.values(LAYER_VARIABLES).flat() as string[]).map(v => ({
      key: v,
      variable: v,
      text: VARIABLE_LABELS[v] ?? v,
      intent: `Anything said that bears on "${VARIABLE_LABELS[v] ?? v}".`,
    }))

  function sanitizeKey(k: string): string {
    return k.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 64) || 'q'
  }

  const keyMap: Record<string, string> = {}
  const sanitizedQuestions = questions.map((q, i) => {
    let safe = sanitizeKey(q.key)
    if (keyMap[safe] || safe === '__free__') safe = `q_${i}_${safe}`.slice(0, 64)
    keyMap[safe] = q.key
    return { ...q, safeKey: safe }
  })

  const isPdf = !!file && (file.type === 'application/pdf' || file.name.endsWith('.pdf'))
  const buffer = file ? Buffer.from(await file.arrayBuffer()) : null

  let userContent: Anthropic.MessageParam['content']

  const questionList = sanitizedQuestions.map((q) =>
    `[${q.safeKey}] (variable: ${q.variable})\n  Question: ${q.text}${q.intent ? `\n  Intent: ${q.intent}` : ''}`
  ).join('\n\n')

  const instruction = `Analyze this conversation transcript. For each briefing question below, extract what the prospect actually said that is relevant — use their words as much as possible, keep it raw and factual. If the topic was not discussed, return an empty string for that question.

Prefix every extracted passage with the name of the speaker as it appears in the transcript. When several people answer the same question, use one line per speaker. Never merge what two people said, and never attribute to a name something they did not say. If the transcript names nobody, write the passage without a prefix rather than inventing one.

Also list the participants in "speakers": their name as written, their title if stated, and which side they are on.

Also extract anything else that was said (objections, names, budget signals, timing, competition, politics, blockers, accelerators) into the __free__ field.

Questions to map against:

${questionList}`

  if (isPdf && buffer) {
    userContent = [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') },
      } as never,
      { type: 'text', text: instruction },
    ]
  } else {
    const text = (buffer ? buffer.toString('utf-8') : pasted).slice(0, 60000)
    userContent = `${instruction}\n\nTranscript:\n${text}`
  }

  const toolProperties: Record<string, { type: string; description: string }> = {}
  for (const q of sanitizedQuestions) {
    toolProperties[q.safeKey] = {
      type: 'string',
      description: `What the prospect said relevant to: ${q.text}. Empty string if not discussed.`,
    }
  }
  toolProperties['__free__'] = {
    type: 'string',
    description: 'Everything else said outside the structured questions: objections, names, budget signals, timing, competition, politics, blockers, accelerators.',
  }

  let message
  try {
    message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: `You are a sales conversation analyst. You read conversation transcripts (from tools like Gong, Chorus, Fireflies, or manual notes) and extract what was said, mapped to specific diagnostic questions. Be faithful to what was actually said — do not interpret or reframe. Use the prospect's actual words and phrasing. Be concise but complete.

WHO SAID IT MATTERS AS MUCH AS WHAT WAS SAID. The scoring engine weighs a statement by the role of the person who made it — a champion's enthusiasm and a budget holder's concession do not carry the same weight. Attribution you drop here cannot be recovered later.` + localeInstruction(locale ?? undefined),
      tools: [
        {
          name: 'fill_capture_notes',
          description: 'Map transcript content to each briefing question',
          input_schema: {
            type: 'object' as const,
            properties: {
              ...toolProperties,
              speakers: {
                type: 'array',
                description: 'Everyone who spoke in this transcript. Only people actually present — never inferred from a mention.',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Name exactly as it appears in the transcript.' },
                    title: { type: 'string', description: 'Their role or title if the transcript states one. Empty otherwise.' },
                    side: { type: 'string', enum: ['prospect', 'seller'], description: 'Which side of the table they sit on.' },
                  },
                  required: ['name', 'side'],
                },
              },
            },
            required: [...sanitizedQuestions.map(q => q.safeKey), '__free__'],
          },
        },
      ],
      tool_choice: { type: 'any' as const },
      messages: [{ role: 'user', content: userContent }],
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'AI request failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  const toolUse = message.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return NextResponse.json({ error: 'No structured response from AI' }, { status: 500 })
  }

  const raw = toolUse.input as Record<string, unknown>
  const speakers = Array.isArray(raw.speakers)
    ? (raw.speakers as { name?: string; title?: string; side?: string }[])
        .filter(sp => typeof sp?.name === 'string' && sp.name.trim())
        .map(sp => ({
          name: sp.name!.trim(),
          title: typeof sp.title === 'string' ? sp.title.trim() : '',
          side: sp.side === 'seller' ? 'seller' : 'prospect',
        }))
    : []

  const notes: Record<string, string> = {}
  for (const [safeKey, value] of Object.entries(raw)) {
    if (safeKey === 'speakers') continue
    if (typeof value !== 'string') continue
    notes[keyMap[safeKey] ?? safeKey] = value
  }

  return NextResponse.json({ notes, speakers })
}
