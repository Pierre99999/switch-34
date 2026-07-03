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
    .slice(0, 12000)
}

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  // Fetch the page
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

  // Ask Claude to extract structured prospect context
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are extracting structured company context from a website's text content for a sales intelligence tool.

Extract the following from the text below. Return ONLY a JSON object with these exact keys. Use empty string "" if information is not available. Be concise — 1-3 sentences per field.

{
  "core_business": "What the company does, their main product or service",
  "industry": "Their industry or market sector",
  "size_stage": "Company size signals (headcount, revenue stage, funding stage if visible)",
  "geography": "Where they operate (HQ, regions, markets served)",
  "priorities": "Current strategic priorities or initiatives mentioned",
  "challenges": "Pain points, problems, or challenges they mention or imply",
  "recent_signals": "Recent news, announcements, launches, or leadership mentions",
  "pressures": "Competitive, regulatory, or market pressures they face"
}

Website text:
${rawText}`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    return NextResponse.json({ error: 'Unexpected response from AI' }, { status: 500 })
  }

  try {
    const cleaned = content.text.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '')
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')
    const extracted = JSON.parse(jsonMatch[0])
    return NextResponse.json({ extracted })
  } catch (e) {
    console.error('AI response parse error:', e, 'Raw response:', content.text.slice(0, 500))
    return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })
  }
}
