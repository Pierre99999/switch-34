import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const apiKey = process.env.ANTHROPIC_API_KEY
console.log('[from-url] API key prefix:', apiKey?.slice(0, 12), 'length:', apiKey?.length, 'ends:', apiKey?.slice(-4))
const client = new Anthropic()

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16000)
}

const SYSTEM_PROMPT = `You are extracting structured vendor intelligence from company website content for a sales methodology tool. Extract information across 9 dimensions. Return ONLY a valid JSON object. Use empty string "" for any field where information is not available. Be concise but specific — 2-4 sentences per field.`

const SCHEMA = `{
  "value": {
    "problem": "The core problem the company solves, who feels it, urgency and cost",
    "point_of_view": "Their distinctive stance, positioning, unique mechanism",
    "value_delivered": "The transformation they deliver, measurable impact, promise",
    "value_reliability": "How fast value appears, early wins, what enables delivery",
    "market_response": "Customer reception, proof points, success signals, objections",
    "competitive_standing": "Real competitive set, differentiation, pricing position"
  },
  "target": {
    "who_youre_for": "Target segments, ICP, best-fit and poor-fit customers",
    "positioning": "Market position, perceived angle, intended vs received brand",
    "market_timing": "Why now, trends, pressures, timing thesis",
    "qualification": "Fit signals, disqualifiers, sales-readiness signals",
    "sales_motion": "Sales stages, buying process, conversion moments",
    "customer_knowledge": "Customer voice, complaints, post-sale signals"
  },
  "product": {
    "current_product": "Current offering, tiers, core features, modules",
    "vision": "Product vision, multi-year goals, transformation",
    "roadmap": "Current priorities, upcoming releases, evolution direction",
    "defensibility": "Moats, proprietary mechanisms, switching costs",
    "user_experience": "Product structure, onboarding, time-to-value, friction",
    "technical_foundation": "Architecture, scalability, performance, constraints",
    "product_health": "Known issues, feedback signals, low-adoption areas"
  },
  "reach": {
    "gtm_model": "GTM model, acquisition approach, funnel structure",
    "reach_focus": "Whether distribution targets right niche or spreads too broadly",
    "message_cta": "Headlines, value proposition, claims, tone, CTA",
    "channels": "Channel mix, audience fit, discovery points",
    "execution_capacity": "Team resources, budget, bandwidth for GTM motion",
    "performance": "Goals, OKRs, funnel performance, known gaps"
  },
  "usage": {
    "core_action": "Where first value happens, where new users get stuck",
    "feature_adoption": "Features that create value, adoption blockers",
    "retention": "Whether users stay active, health signals",
    "churn": "Why customers leave, early warning signals",
    "expansion": "Account growth signals, referral, advocacy",
    "monetization": "Pricing, packaging, tiers, value capture",
    "instrumentation": "Usage metrics tracked and acted on"
  },
  "finance": {
    "revenue": "Revenue model, growth trajectory, predictability",
    "costs": "Spending, burn, cost discipline",
    "capital_runway": "Cash position, funding status, runway",
    "unit_economics": "CAC, LTV, payback, margins",
    "forecasting": "Cash and P&L projection capability"
  },
  "scale": {
    "growth_channel": "Whether main growth channel can scale without breaking economics",
    "bottleneck": "Main constraint to growth",
    "investment_focus": "Where investment and effort are concentrated",
    "talent_plan": "Team gaps, hiring needs, org capacity"
  },
  "playbook": {
    "capture_lessons": "How team learns from wins, losses, patterns",
    "codify": "Whether lessons become written standards and methods",
    "build_capability": "How playbooks develop team skills",
    "impact": "Whether playbooks improve business KPIs"
  },
  "foundations": {
    "vision_purpose": "Company why and direction, clarity and alignment",
    "culture": "Culture, values in practice, leadership behavior",
    "team_status": "Structure, role clarity, performance, capacity",
    "engagement": "Morale, burnout risk, psychological safety",
    "strengths": "Honest strengths, weaknesses, improvement priorities"
  }
}`

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

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
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: 'save_vendor_profile',
        description: 'Save extracted vendor intelligence across 9 dimensions',
        input_schema: {
          type: 'object' as const,
          properties: {
            value: { type: 'object', properties: { problem: { type: 'string' }, point_of_view: { type: 'string' }, value_delivered: { type: 'string' }, value_reliability: { type: 'string' }, market_response: { type: 'string' }, competitive_standing: { type: 'string' } }, required: [] },
            target: { type: 'object', properties: { who_youre_for: { type: 'string' }, positioning: { type: 'string' }, market_timing: { type: 'string' }, qualification: { type: 'string' }, sales_motion: { type: 'string' }, customer_knowledge: { type: 'string' } }, required: [] },
            product: { type: 'object', properties: { current_product: { type: 'string' }, vision: { type: 'string' }, roadmap: { type: 'string' }, defensibility: { type: 'string' }, user_experience: { type: 'string' }, technical_foundation: { type: 'string' }, product_health: { type: 'string' } }, required: [] },
            reach: { type: 'object', properties: { gtm_model: { type: 'string' }, reach_focus: { type: 'string' }, message_cta: { type: 'string' }, channels: { type: 'string' }, execution_capacity: { type: 'string' }, performance: { type: 'string' } }, required: [] },
            usage: { type: 'object', properties: { core_action: { type: 'string' }, feature_adoption: { type: 'string' }, retention: { type: 'string' }, churn: { type: 'string' }, expansion: { type: 'string' }, monetization: { type: 'string' }, instrumentation: { type: 'string' } }, required: [] },
            finance: { type: 'object', properties: { revenue: { type: 'string' }, costs: { type: 'string' }, capital_runway: { type: 'string' }, unit_economics: { type: 'string' }, forecasting: { type: 'string' } }, required: [] },
            scale: { type: 'object', properties: { growth_channel: { type: 'string' }, bottleneck: { type: 'string' }, investment_focus: { type: 'string' }, talent_plan: { type: 'string' } }, required: [] },
            playbook: { type: 'object', properties: { capture_lessons: { type: 'string' }, codify: { type: 'string' }, build_capability: { type: 'string' }, impact: { type: 'string' } }, required: [] },
            foundations: { type: 'object', properties: { vision_purpose: { type: 'string' }, culture: { type: 'string' }, team_status: { type: 'string' }, engagement: { type: 'string' }, strengths: { type: 'string' } }, required: [] },
          },
          required: [],
        },
      },
    ],
    tool_choice: { type: 'any' as const },
    messages: [{
      role: 'user',
      content: `Extract vendor intelligence from this website content and call save_vendor_profile. Only populate fields where the content clearly supports it — leave others as empty string.\n\nWebsite content:\n${rawText}`,
    }],
  })

  const toolUse = message.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return NextResponse.json({ error: 'No structured response from AI' }, { status: 500 })
  }
  return NextResponse.json({ dimensions: toolUse.input })
}
