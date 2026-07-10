import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const { dimensions, locale } = await req.json()
  if (!dimensions || !locale) return NextResponse.json({ error: 'Missing dimensions or locale' }, { status: 400 })

  const targetLang = locale === 'fr' ? 'French' : 'English'

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: `You are a translator. Translate ALL text values in the provided JSON object to ${targetLang}. Keep the JSON structure and keys exactly the same. Only translate the string values. Keep empty strings as empty strings. Return valid JSON only.`,
    messages: [{
      role: 'user',
      content: `Translate all values to ${targetLang}:\n\n${JSON.stringify(dimensions)}`,
    }],
  })

  const text = message.content.find(b => b.type === 'text')
  if (!text || text.type !== 'text') return NextResponse.json({ error: 'No response' }, { status: 500 })

  try {
    const jsonMatch = text.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Invalid JSON response' }, { status: 500 })
    const translated = JSON.parse(jsonMatch[0])
    return NextResponse.json({ dimensions: translated })
  } catch {
    return NextResponse.json({ error: 'Failed to parse translation' }, { status: 500 })
  }
}
