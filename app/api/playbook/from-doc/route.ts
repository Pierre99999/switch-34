export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { playbookTool, playbookFromToolInput } from '@/lib/playbook-extract'
import { recordUsage } from '@/lib/ai-usage'

const client = new Anthropic()

const INSTRUCTION = 'Build the Sales Playbook socle from this document, and call save_playbook. Only fill what the document genuinely supports.'

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const locale = (formData.get('locale') as string | null) ?? 'fr'
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const isPdf = file.type === 'application/pdf'
  const isText = file.type === 'text/plain' || file.type === 'text/markdown'
    || file.name.endsWith('.txt') || file.name.endsWith('.md')
  if (!isPdf && !isText) {
    return NextResponse.json({ error: 'Unsupported file type. Please upload a PDF or plain text file.' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  let messageContent: Anthropic.MessageParam['content']
  if (isPdf) {
    messageContent = [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: Buffer.from(bytes).toString('base64') },
      } as Anthropic.DocumentBlockParam,
      { type: 'text', text: INSTRUCTION },
    ]
  } else {
    const text = new TextDecoder().decode(bytes).slice(0, 20000)
    messageContent = `${INSTRUCTION}\n\nDocument content:\n${text}`
  }

  const { system, tool } = playbookTool(locale)

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system,
    tools: [tool],
    tool_choice: { type: 'any' as const },
    messages: [{ role: 'user', content: messageContent }],
  })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) await recordUsage(supabase, { userId: user.id, route: 'playbook/from-doc', model: 'claude-sonnet-4-6', usage: message.usage })

  // A cut-off tool call still parses, with rows missing. Refuse it rather
  // than presenting a half-read site as the finished socle.
  if (message.stop_reason === 'max_tokens') {
    return NextResponse.json({ error: 'The analysis was cut short. Nothing was saved — try again.' }, { status: 502 })
  }

  const toolUse = message.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return NextResponse.json({ error: 'No structured response from AI' }, { status: 500 })
  }
  return NextResponse.json({ playbook: playbookFromToolInput(toolUse.input, locale) })
}
