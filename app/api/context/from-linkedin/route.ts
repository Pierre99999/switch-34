import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { localeInstruction } from '@/lib/ai-locale'

const client = new Anthropic()

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 10000)
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const { url, locale } = await req.json()
  if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 })

  let rawText = ''
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`
    const res = await fetch(normalized, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    })
    const html = await res.text()
    rawText = stripHtml(html)
  } catch {
    return NextResponse.json({ error: 'Could not fetch the URL. Check it is publicly accessible.' }, { status: 422 })
  }

  // If LinkedIn returns a login wall, the text will be sparse
  if (rawText.length < 200) {
    return NextResponse.json({ error: 'LinkedIn returned a login page. Paste the profile text manually into the Key Contact fields instead.' }, { status: 422 })
  }

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: 'You are extracting structured contact intelligence from a LinkedIn profile page for a sales CRM. Be concise — 1-3 sentences per field. Use empty string for fields not evidenced in the content.' + localeInstruction(locale),
    tools: [
      {
        name: 'save_contact_context',
        description: 'Save extracted key contact intelligence',
        input_schema: {
          type: 'object' as const,
          properties: {
            key_contact: {
              type: 'object',
              properties: {
                role_accountability: { type: 'string', description: 'Their current role, what they own, what they are measured on' },
                background: { type: 'string', description: 'Career history, domain expertise, how long in this role' },
                personal_priorities: { type: 'string', description: 'What they likely care about given their position — visibility, risk, performance' },
                influence_level: { type: 'string', description: 'Their probable authority in a buying process based on seniority and role' },
              },
              required: [],
            },
          },
          required: ['key_contact'],
        },
      },
    ],
    tool_choice: { type: 'any' as const },
    messages: [{
      role: 'user',
      content: `Extract contact intelligence from this LinkedIn profile. Only populate fields clearly supported by the content.\n\nProfile content:\n${rawText}`,
    }],
  })

  const toolUse = message.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return NextResponse.json({ error: 'No structured response from AI' }, { status: 500 })
  }
  return NextResponse.json({ dimensions: toolUse.input })
}
