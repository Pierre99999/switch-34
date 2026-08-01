export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { fetchPageText } from '@/lib/scrape'
import { playbookTool, playbookFromToolInput } from '@/lib/playbook-extract'
import { recordUsage } from '@/lib/ai-usage'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const { url, locale } = await req.json()
  if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const rawText = await fetchPageText(url)
  if (rawText.length < 100) {
    return NextResponse.json({ error: 'Could not extract readable content from this site. Check the URL, or import a document instead.' }, { status: 422 })
  }

  const { system, tool } = playbookTool(locale)

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system,
    tools: [tool],
    tool_choice: { type: 'any' as const },
    messages: [{
      role: 'user',
      content: `Build the Sales Playbook socle from this website content, and call save_playbook. Only fill what the content genuinely supports.\n\nWebsite content:\n${rawText}`,
    }],
  })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) await recordUsage(supabase, { userId: user.id, route: 'playbook/from-url', model: 'claude-sonnet-4-6', usage: message.usage })

  const toolUse = message.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return NextResponse.json({ error: 'No structured response from AI' }, { status: 500 })
  }
  return NextResponse.json({ playbook: playbookFromToolInput(toolUse.input, locale) })
}
