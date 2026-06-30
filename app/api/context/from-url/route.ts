import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 14000)
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 })

  let rawText = ''
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`
    const res = await fetch(normalized, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Switch/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    const html = await res.text()
    rawText = stripHtml(html)
  } catch {
    return NextResponse.json({ error: 'Could not fetch the URL. Check it is publicly accessible.' }, { status: 422 })
  }

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1536,
    system: 'You are extracting structured company intelligence from a website for a sales CRM. Be concise — 1-3 sentences per field. Use empty string for fields not evidenced in the content.',
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
                core_business: { type: 'string', description: 'What they do, main product or service, business model' },
                industry: { type: 'string', description: 'Sector, competitive environment, market they operate in' },
                size_stage: { type: 'string', description: 'Headcount, revenue signals, growth phase, funding status' },
                geography: { type: 'string', description: 'HQ, regions, markets served, operating model' },
              },
              required: [],
            },
            strategic_context: {
              type: 'object',
              properties: {
                priorities: { type: 'string', description: 'What they are focused on — growth, efficiency, compliance, transformation' },
                challenges: { type: 'string', description: 'Operational pain points, recurring problems, friction areas' },
                recent_signals: { type: 'string', description: 'News, announcements, leadership changes, new initiatives' },
                pressures: { type: 'string', description: 'Regulatory, competitive, financial, or market pressures' },
              },
              required: [],
            },
            buying_environment: {
              type: 'object',
              properties: {
                decision_process: { type: 'string', description: 'How buying decisions are made, approval layers, stakeholders involved' },
                budget_signals: { type: 'string', description: 'Budget cycle, existing tools spend, procurement style' },
                timeline: { type: 'string', description: 'Known deadlines, board commitments, fiscal pressures, urgency triggers' },
                history: { type: 'string', description: 'Have they tried before? Switched vendors? Failed implementations?' },
              },
              required: [],
            },
          },
          required: ['company', 'strategic_context', 'buying_environment'],
        },
      },
    ],
    tool_choice: { type: 'any' as const },
    messages: [{
      role: 'user',
      content: `Extract company intelligence from this website content. Only populate fields clearly supported by the content.\n\nWebsite:\n${rawText}`,
    }],
  })

  const toolUse = message.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return NextResponse.json({ error: 'No structured response from AI' }, { status: 500 })
  }
  return NextResponse.json({ dimensions: toolUse.input })
}
