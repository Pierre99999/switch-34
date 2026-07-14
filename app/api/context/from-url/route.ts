export const maxDuration = 300

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
    .slice(0, 14000)
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  try {
  const { url, locale, salesContext } = await req.json()
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

  const contextInstruction = salesContext
    ? `\n\nThe salesperson wants to understand: "${salesContext}". Let this GUIDE which dimensions you emphasize — but every dimension must still be grounded in what the website actually shows, and every field must be filled from the site content. Do not create empty concern-shaped dimensions.`
    : ''

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: `You are building a prospect intelligence profile for a sales CRM from a company's website.

Extract concrete, factual information from the website content and organize it into 3-7 analysis dimensions, each with 2-5 fields (company activity, offering, target market, clients, positioning, proof points, traction, etc.). ALWAYS fill each field with what the website reveals or reasonably implies — 1-3 sentences per value. Only leave a value empty if the website genuinely says nothing about it; prefer inferring from available content over leaving blanks.${contextInstruction}` + localeInstruction(locale),
    tools: [
      {
        name: 'save_prospect_profile',
        description: 'Save a dynamically structured prospect profile with custom dimensions',
        input_schema: {
          type: 'object' as const,
          properties: {
            dimensions: {
              type: 'array',
              description: 'Array of analysis dimensions, each with a key, label, and fields',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string', description: 'Snake_case unique key for this dimension' },
                  label: { type: 'string', description: 'Human-readable label for this dimension' },
                  fields: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        key: { type: 'string', description: 'Snake_case unique key for this field' },
                        label: { type: 'string', description: 'Human-readable label' },
                        hint: { type: 'string', description: 'Short hint explaining what this field captures' },
                        value: { type: 'string', description: 'Extracted information from the website, or empty string if not found' },
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
    messages: [{
      role: 'user',
      content: `Analyze this company website and build a prospect profile with the most relevant dimensions.\n\nWebsite content:\n${rawText}`,
    }],
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
