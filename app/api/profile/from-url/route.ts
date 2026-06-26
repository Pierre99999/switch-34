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
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ScoreJam/1.0)' },
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
    messages: [{
      role: 'user',
      content: `Extract vendor intelligence from this website content and return the JSON schema below. Only populate fields where the content clearly supports it.\n\nSchema to fill:\n${SCHEMA}\n\nWebsite content:\n${rawText}`,
    }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON')
    return NextResponse.json({ dimensions: JSON.parse(match[0]) })
  } catch {
    return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })
  }
}
