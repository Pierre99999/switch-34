import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { localeInstruction } from '@/lib/ai-locale'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const locale = formData.get('locale') as string | null
  const salesContext = formData.get('salesContext') as string | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf')
  const buffer = Buffer.from(await file.arrayBuffer())

  const contextInstruction = salesContext
    ? `\n\nThe salesperson has indicated what is important to understand about this prospect:\n"${salesContext}"\n\nDesign your analysis dimensions specifically around these concerns.`
    : ''

  let userContent: Anthropic.MessageParam['content']

  if (isPdf) {
    userContent = [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') },
      } as never,
      { type: 'text', text: 'Analyze this document and build a prospect profile with the most relevant dimensions.' },
    ]
  } else {
    const text = buffer.toString('utf-8').slice(0, 14000)
    userContent = `Analyze this document and build a prospect profile with the most relevant dimensions.\n\n${text}`
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `You are building a dynamic prospect intelligence profile from a document for a sales CRM. Based on the document content and what the salesperson needs to understand, define the most relevant analysis dimensions and fill them.

Each dimension should have 2-5 fields. Create 3-7 dimensions depending on what is relevant. Be concise — 1-3 sentences per field value. Leave value as empty string for fields not evidenced.${contextInstruction}` + localeInstruction(locale ?? undefined),
    tools: [
      {
        name: 'save_prospect_profile',
        description: 'Save a dynamically structured prospect profile with custom dimensions',
        input_schema: {
          type: 'object' as const,
          properties: {
            dimensions: {
              type: 'array',
              description: 'Array of analysis dimensions',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string', description: 'Snake_case unique key' },
                  label: { type: 'string', description: 'Human-readable label' },
                  fields: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        key: { type: 'string', description: 'Snake_case unique key' },
                        label: { type: 'string', description: 'Human-readable label' },
                        hint: { type: 'string', description: 'Short hint' },
                        value: { type: 'string', description: 'Extracted information or empty string' },
                      },
                      required: ['key', 'label', 'hint', 'value'],
                    },
                  },
                },
                required: ['key', 'label', 'fields'],
              },
            },
          },
          required: ['dimensions'],
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

  const input = toolUse.input as { dimensions: Array<{ key: string; label: string; fields: Array<{ key: string; label: string; hint: string; value: string }> }> }

  return NextResponse.json({
    dimensions: {
      _dynamic: true,
      sales_context: salesContext || '',
      dimensions: input.dimensions,
    },
  })
}
