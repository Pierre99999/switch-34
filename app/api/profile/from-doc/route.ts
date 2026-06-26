import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are extracting structured vendor intelligence from a company document (pitch deck, product overview, company brief, etc.) for a sales methodology tool. Extract information across 9 dimensions. Return ONLY a valid JSON object. Use empty string "" for any field where information is not available. Be concise but specific — 2-4 sentences per field.`

const SCHEMA = `{
  "value": { "problem": "", "point_of_view": "", "value_delivered": "", "value_reliability": "", "market_response": "", "competitive_standing": "" },
  "target": { "who_youre_for": "", "positioning": "", "market_timing": "", "qualification": "", "sales_motion": "", "customer_knowledge": "" },
  "product": { "current_product": "", "vision": "", "roadmap": "", "defensibility": "", "user_experience": "", "technical_foundation": "", "product_health": "" },
  "reach": { "gtm_model": "", "reach_focus": "", "message_cta": "", "channels": "", "execution_capacity": "", "performance": "" },
  "usage": { "core_action": "", "feature_adoption": "", "retention": "", "churn": "", "expansion": "", "monetization": "", "instrumentation": "" },
  "finance": { "revenue": "", "costs": "", "capital_runway": "", "unit_economics": "", "forecasting": "" },
  "scale": { "growth_channel": "", "bottleneck": "", "investment_focus": "", "talent_plan": "" },
  "playbook": { "capture_lessons": "", "codify": "", "build_capability": "", "impact": "" },
  "foundations": { "vision_purpose": "", "culture": "", "team_status": "", "engagement": "", "strengths": "" }
}`

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown']
  const isPdf = file.type === 'application/pdf'
  const isText = file.type === 'text/plain' || file.type === 'text/markdown' || file.name.endsWith('.txt') || file.name.endsWith('.md')

  if (!isPdf && !isText) {
    return NextResponse.json({ error: 'Unsupported file type. Please upload a PDF or plain text file.' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()

  let messageContent: Anthropic.MessageParam['content']

  if (isPdf) {
    const base64 = Buffer.from(bytes).toString('base64')
    messageContent = [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      } as Anthropic.DocumentBlockParam,
      {
        type: 'text',
        text: `Extract vendor intelligence from this document and return the JSON schema below. Only populate fields where the document clearly supports it.\n\nSchema to fill:\n${SCHEMA}`,
      },
    ]
  } else {
    const text = new TextDecoder().decode(bytes).slice(0, 20000)
    messageContent = `Extract vendor intelligence from this document and return the JSON schema below. Only populate fields where the document clearly supports it.\n\nSchema to fill:\n${SCHEMA}\n\nDocument content:\n${text}`
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: messageContent }],
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
  try {
    const match = responseText.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON')
    return NextResponse.json({ dimensions: JSON.parse(match[0]) })
  } catch {
    return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })
  }
}
