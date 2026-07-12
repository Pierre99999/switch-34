export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { localeInstruction } from '@/lib/ai-locale'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const questionsJson = formData.get('questions') as string | null
  const locale = formData.get('locale') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!questionsJson) return NextResponse.json({ error: 'No questions provided' }, { status: 400 })

  const questions: { key: string; variable: string; text: string; intent?: string }[] = JSON.parse(questionsJson)

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

  const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf')
  const buffer = Buffer.from(await file.arrayBuffer())

  let userContent: Anthropic.MessageParam['content']

  const questionList = sanitizedQuestions.map((q) =>
    `[${q.safeKey}] (variable: ${q.variable})\n  Question: ${q.text}${q.intent ? `\n  Intent: ${q.intent}` : ''}`
  ).join('\n\n')

  const instruction = `Analyze this conversation transcript. For each briefing question below, extract what the prospect actually said that is relevant — use their words as much as possible, keep it raw and factual. If the topic was not discussed, return an empty string for that question.

Also extract anything else that was said (objections, names, budget signals, timing, competition, politics, blockers, accelerators) into the __free__ field.

Questions to map against:

${questionList}`

  if (isPdf) {
    userContent = [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') },
      } as never,
      { type: 'text', text: instruction },
    ]
  } else {
    const text = buffer.toString('utf-8').slice(0, 60000)
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
      system: `You are a sales conversation analyst. You read conversation transcripts (from tools like Gong, Chorus, Fireflies, or manual notes) and extract what was said, mapped to specific diagnostic questions. Be faithful to what was actually said — do not interpret or reframe. Use the prospect's actual words and phrasing. Be concise but complete.` + localeInstruction(locale ?? undefined),
      tools: [
        {
          name: 'fill_capture_notes',
          description: 'Map transcript content to each briefing question',
          input_schema: {
            type: 'object' as const,
            properties: toolProperties,
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

  const rawNotes = toolUse.input as Record<string, string>
  const notes: Record<string, string> = {}
  for (const [safeKey, value] of Object.entries(rawNotes)) {
    notes[keyMap[safeKey] ?? safeKey] = value
  }

  return NextResponse.json({ notes })
}
