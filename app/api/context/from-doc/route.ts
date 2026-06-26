import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf')
  const buffer = Buffer.from(await file.arrayBuffer())

  let userContent: Anthropic.MessageParam['content']

  if (isPdf) {
    userContent = [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') },
      } as never,
      { type: 'text', text: 'Extract company intelligence from this document. Only populate fields clearly supported by the content.' },
    ]
  } else {
    const text = buffer.toString('utf-8').slice(0, 14000)
    userContent = `Extract company intelligence from this document.\n\n${text}`
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1536,
    system: 'You are extracting structured company intelligence from a document for a sales CRM. Be concise — 1-3 sentences per field. Use empty string for fields not evidenced in the content.',
    tools: [
      {
        name: 'save_company_context',
        description: 'Save extracted company context across three dimensions',
        input_schema: {
          type: 'object' as const,
          properties: {
            company: {
              type: 'object',
              properties: {
                core_business: { type: 'string' },
                industry: { type: 'string' },
                size_stage: { type: 'string' },
                geography: { type: 'string' },
              },
              required: [],
            },
            strategic_context: {
              type: 'object',
              properties: {
                priorities: { type: 'string' },
                challenges: { type: 'string' },
                recent_signals: { type: 'string' },
                pressures: { type: 'string' },
              },
              required: [],
            },
            buying_environment: {
              type: 'object',
              properties: {
                decision_process: { type: 'string' },
                budget_signals: { type: 'string' },
                timeline: { type: 'string' },
                history: { type: 'string' },
              },
              required: [],
            },
          },
          required: ['company', 'strategic_context', 'buying_environment'],
        },
      },
    ],
    tool_choice: { type: 'any' as const },
    messages: [{ role: 'user', content: userContent }],
  })

  const toolUse = message.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return NextResponse.json({ error: 'No structured response from AI' }, { status: 500 })
  }
  return NextResponse.json({ dimensions: toolUse.input })
}
