'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Vendor, type VendorDimensions, EMPTY_VENDOR_DIMENSIONS } from '@/lib/types'

// ── Dimension definitions ────────────────────────────────────

type SubQuestion = { key: string; label: string; hint: string }
type DimensionDef = { key: keyof VendorDimensions; label: string; description: string; questions: SubQuestion[] }

const DIMENSIONS: DimensionDef[] = [
  {
    key: 'value', label: '1 · Value', description: 'Whether you have identified a real problem, articulated a distinctive point of view, created value that lands, earned market validation, and understand your competitive standing.',
    questions: [
      { key: 'problem', label: "The problem you're solving", hint: 'How real and urgent the pain is, who feels it most, what it costs, current alternatives, and surrounding misconceptions.' },
      { key: 'point_of_view', label: "Your point of view and how you're different", hint: 'Your distinctive stance, unique mechanism, positioning, and how clearly that stance comes through.' },
      { key: 'value_delivered', label: 'The value you deliver', hint: 'The before/after transformation, value drivers, measurable impact, and stated promise.' },
      { key: 'value_reliability', label: 'Whether the value reliably lands', hint: 'How fast value appears, what delivery means, what creates early wins, and what enables or blocks realization.' },
      { key: 'market_response', label: 'How the market actually responds', hint: 'Customer reception, proof points, objections, high-value outcomes, and visible success signals.' },
      { key: 'competitive_standing', label: 'Where you stand against the alternatives', hint: 'The real competitive set, differentiation in deals, pricing position, market context, and recent shifts.' },
    ],
  },
  {
    key: 'target', label: '2 · Target', description: 'Whether you are going after the right people, at the right time, with the right framing, and whether you qualify, convert, and still understand them.',
    questions: [
      { key: 'who_youre_for', label: "Who you're for", hint: 'Target segments, ICP, personas, best-fit and poor-fit customers, fit signals, and prioritized segments.' },
      { key: 'positioning', label: "How you're positioned and perceived", hint: 'Market position, perceived angle, messaging surfaces, and the gap between intended and received brand.' },
      { key: 'market_timing', label: 'Why now — market timing', hint: 'Trends, pressures, tech or regulatory shifts, market risk, and the timing thesis behind the opportunity.' },
      { key: 'qualification', label: 'What makes a prospect a fit', hint: 'Qualification logic, decisive fit features, disqualifiers, tier logic, and sales-readiness signals.' },
      { key: 'sales_motion', label: 'How the sales motion converts', hint: 'Sales stages, objections, delays, alternatives, buying process, conversion moments, and proof required.' },
      { key: 'customer_knowledge', label: 'How well you actually know them', hint: 'Freshness and depth of customer understanding, customer voice, complaints, post-sale signals, and listening cadence.' },
    ],
  },
  {
    key: 'product', label: '3 · Product', description: 'The product\'s concrete state, vision, roadmap discipline, defensibility, user experience, technical foundation, and health in real use.',
    questions: [
      { key: 'current_product', label: 'What the product is today', hint: 'Current offering, tiers, core features, modules, and the concrete product as it exists now.' },
      { key: 'vision', label: 'Product vision', hint: 'Clarity, ambition, transformation, positioning, and whether multi-year goals support the vision.' },
      { key: 'roadmap', label: "The roadmap and what you're building", hint: 'Current priorities, upcoming releases, beta features, and how the product is evolving.' },
      { key: 'defensibility', label: 'What makes it hard to copy', hint: 'Proprietary mechanisms, moats, switching costs, proof of defensibility, and what competitors cannot easily replicate.' },
      { key: 'user_experience', label: 'The user experience', hint: 'Product structure, navigation, onboarding, time-to-value, key flows, and friction points.' },
      { key: 'technical_foundation', label: 'Technical foundation', hint: 'Scalability, architecture, performance, technical debt, organizational requirements, and known constraints.' },
      { key: 'product_health', label: 'Product health in the wild', hint: 'Bugs, customer complaints, low-adoption features, recent changes, and feedback across user segments.' },
    ],
  },
  {
    key: 'reach', label: '4 · Reach', description: 'How you reach your market through GTM strategy, distribution focus, messaging, channels, execution capacity, and performance against goals.',
    questions: [
      { key: 'gtm_model', label: 'How you go to market', hint: 'GTM model, acquisition approach, funnel structure, conversion points, and buying-cycle friction.' },
      { key: 'reach_focus', label: 'Whether your reach is aimed at the right people', hint: 'Whether distribution is focused on the right niche and urgent pain, or spread too broadly.' },
      { key: 'message_cta', label: 'Your message and call to action', hint: 'Clarity and distinctiveness of headlines, value proposition, claims, proof, tone, and CTA.' },
      { key: 'channels', label: 'Your channels', hint: 'Channel mix, audience fit, discovery points, proof channels, and influence touchpoints.' },
      { key: 'execution_capacity', label: 'Your capacity to execute', hint: 'Whether the team has enough resources, budget, and bandwidth to run the GTM motion.' },
      { key: 'performance', label: 'Whether it\'s working — objectives vs actuals', hint: 'Goals, OKRs, funnel tracking, execution focus, and whether performance variance is understood.' },
    ],
  },
  {
    key: 'usage', label: '5 · Usage', description: 'How users actually engage with the product: activation, adoption, retention, churn, expansion, monetization, and instrumentation.',
    questions: [
      { key: 'core_action', label: 'Getting to the core action', hint: 'Whether users reach first value quickly, where the core action happens, and where new users get stuck.' },
      { key: 'feature_adoption', label: 'Feature adoption', hint: 'Whether users adopt the features that create value, what blocks adoption, and how deep usage becomes.' },
      { key: 'retention', label: 'Retention and engagement', hint: 'Whether users stay active, remain healthy, progress over time, and continue perceiving value.' },
      { key: 'churn', label: 'Churn and account risk', hint: 'Why customers leave, early warning signs, commercial risks, organizational instability, and champion vulnerability.' },
      { key: 'expansion', label: 'Expansion and advocacy', hint: 'Signals that accounts are ready to grow, expand usage, refer others, or advocate publicly.' },
      { key: 'monetization', label: 'Monetization', hint: 'How usage converts into revenue through pricing, packaging, tiers, value capture, and price sensitivity.' },
      { key: 'instrumentation', label: 'Usage metrics and instrumentation', hint: 'Whether the team measures the right usage metrics and uses them to make decisions.' },
    ],
  },
  {
    key: 'finance', label: '6 · Finance', description: 'Cash discipline, revenue trajectory, expense control, financial literacy, unit economics, and forecasting capability.',
    questions: [
      { key: 'revenue', label: 'Revenue', hint: 'Revenue model, growth trajectory, expansion and retention drivers, and predictability of growth.' },
      { key: 'costs', label: 'Costs', hint: 'Spending, burn, team cost, cost discipline, and whether expenses are proportional to growth.' },
      { key: 'capital_runway', label: 'Capital and runway', hint: 'Cash position, funding status, burn versus growth, runway, and recent financial events.' },
      { key: 'unit_economics', label: 'Financial metrics and unit economics', hint: 'CAC, LTV, payback, margins, ROI thinking, and whether the team acts on these numbers.' },
      { key: 'forecasting', label: 'Forecasting', hint: 'Ability to project cash and P&L, forecast beyond 12 months, and adjust based on real data.' },
    ],
  },
  {
    key: 'scale', label: '7 · Scale', description: 'Whether you are ready to grow: scalable channels, bottleneck elimination, investment focus, and talent planning.',
    questions: [
      { key: 'growth_channel', label: 'Whether your growth channel can scale', hint: 'Whether the main growth channel can double without breaking CAC, LTV, margins, or operations.' },
      { key: 'bottleneck', label: 'Your growth bottleneck', hint: 'The main constraint to growth — technical, operational, support, organizational, or authority-related.' },
      { key: 'investment_focus', label: 'Where you\'re investing and focusing', hint: 'Whether investment and effort go to the highest-ROI priority instead of scattered initiatives.' },
      { key: 'talent_plan', label: 'Your talent and hiring plan', hint: 'Current team gaps, future hiring needs, org capacity, and whether hiring supports the roadmap.' },
    ],
  },
  {
    key: 'playbook', label: '8 · Playbook', description: 'Whether you capture, codify, share, and apply learnings to improve operational performance.',
    questions: [
      { key: 'capture_lessons', label: 'How you capture lessons', hint: 'Whether the team learns from wins, losses, projects, deals, failures, and recurring patterns.' },
      { key: 'codify', label: 'How you codify what works', hint: 'Whether lessons become written playbooks, standards, role expectations, and repeatable methods.' },
      { key: 'build_capability', label: 'How you build team capability', hint: 'Whether the team uses playbooks to develop skills, spread knowledge, and improve collaboration.' },
      { key: 'impact', label: 'Whether it moves the numbers', hint: 'Whether playbooks improve business KPIs and create measurable operational impact.' },
    ],
  },
  {
    key: 'foundations', label: '9 · Foundations', description: 'The organizational base: vision, culture, team health, engagement, wellbeing, and self-awareness.',
    questions: [
      { key: 'vision_purpose', label: 'Vision and purpose', hint: 'Whether the company\'s why and direction are clear, understood, and lived by the team.' },
      { key: 'culture', label: 'Culture and lived values', hint: 'Whether culture is intentional, codified, lived in practice, and reflected in leadership behavior.' },
      { key: 'team_status', label: 'Team status', hint: 'Team structure, role clarity, performance, development needs, and organizational capacity.' },
      { key: 'engagement', label: 'Engagement and wellbeing', hint: 'Morale, engagement, burnout risk, psychological safety, and readiness during change.' },
      { key: 'strengths', label: 'Strengths and improvement', hint: 'Whether you honestly understand your strengths, weaknesses, and improvement priorities.' },
    ],
  },
]

// ── Helpers ──────────────────────────────────────────────────

function filledCount(dim: Record<string, string>): number {
  return Object.values(dim).filter(v => v.trim().length > 0).length
}

function deepMerge(base: VendorDimensions, saved: Partial<VendorDimensions>): VendorDimensions {
  const result = { ...base }
  for (const key of Object.keys(saved) as (keyof VendorDimensions)[]) {
    if (saved[key]) result[key] = { ...base[key], ...saved[key] } as never
  }
  return result
}

// ── Dimension section ────────────────────────────────────────

function DimensionSection({
  def,
  values,
  onChange,
  onSave,
  saving,
}: {
  def: DimensionDef
  values: Record<string, string>
  onChange: (key: string, val: string) => void
  onSave: () => void
  saving: boolean
}) {
  const [open, setOpen] = useState(false)
  const total = def.questions.length
  const filled = filledCount(values)

  return (
    <div className="border border-stone-300 bg-white">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-baseline gap-4">
          <span className="font-serif italic text-stone-900 text-base">{def.label}</span>
          <span className="text-[10px] uppercase tracking-widest text-stone-500 font-mono hidden sm:block">{def.description.slice(0, 60)}…</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          <span className={`text-[10px] uppercase tracking-widest font-mono ${filled === total ? 'text-emerald-700' : filled > 0 ? 'text-amber-700' : 'text-stone-400'}`}>
            {filled}/{total}
          </span>
          <span className="text-stone-400 font-mono text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-stone-200 px-5 py-5">
          <p className="text-xs text-stone-500 leading-relaxed mb-6 border-l-2 border-stone-200 pl-3">{def.description}</p>
          <div className="space-y-5">
            {def.questions.map(q => (
              <div key={q.key}>
                <label className="text-xs font-medium text-stone-800">{q.label}</label>
                <p className="text-[11px] text-stone-400 mt-0.5 mb-1.5">{q.hint}</p>
                <textarea
                  value={values[q.key] ?? ''}
                  onChange={e => onChange(q.key, e.target.value)}
                  rows={3}
                  placeholder="…"
                  className="w-full border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-900 font-mono focus:outline-none focus:border-stone-900 focus:bg-white resize-none"
                />
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-3 pt-4 border-t border-stone-200">
            <button
              onClick={onSave}
              disabled={saving}
              className="px-4 py-2 bg-stone-900 text-stone-50 text-xs uppercase tracking-widest font-mono hover:bg-stone-800 disabled:opacity-40"
            >
              {saving ? 'saving…' : 'save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────

export default function ProfilePage() {
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [dims, setDims] = useState<VendorDimensions>(EMPTY_VENDOR_DIMENSIONS)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('vendors').select('*').eq('user_id', user.id).single()
    if (data) {
      setVendor(data)
      setDims(deepMerge(EMPTY_VENDOR_DIMENSIONS, data.dimensions ?? {}))
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handleChange(dimKey: keyof VendorDimensions, subKey: string, val: string) {
    setDims(d => ({ ...d, [dimKey]: { ...d[dimKey], [subKey]: val } }))
  }

  async function handleSave(dimKey: keyof VendorDimensions) {
    if (!vendor) return
    setSavingKey(dimKey)
    const supabase = createClient()
    const merged = { ...(vendor.dimensions ?? {}), [dimKey]: dims[dimKey] }
    await supabase.from('vendors').update({ dimensions: merged }).eq('id', vendor.id)
    await load()
    setSavingKey(null)
  }

  const totalFilled = DIMENSIONS.reduce((acc, d) => acc + filledCount(dims[d.key] as Record<string, string>), 0)
  const totalQuestions = DIMENSIONS.reduce((acc, d) => acc + d.questions.length, 0)

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      {/* Header */}
      <div className="flex items-baseline justify-between pb-4 mb-8 border-b border-stone-300">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500 font-mono mb-1">ScoreJam · vendor profile</div>
          <h1 className="font-serif text-2xl text-stone-900 italic">{vendor?.company_name ?? '…'}</h1>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">profile completion</div>
          <div className={`font-mono text-lg mt-0.5 ${totalFilled === totalQuestions ? 'text-emerald-800' : totalFilled > 0 ? 'text-amber-700' : 'text-stone-400'}`}>
            {totalFilled}/{totalQuestions}
          </div>
        </div>
      </div>

      <div className="border-l-2 border-stone-900 pl-4 py-2 mb-8 bg-stone-50">
        <div className="text-[10px] uppercase tracking-widest text-stone-500 font-mono mb-1">how to use this</div>
        <p className="text-sm text-stone-800 font-serif italic leading-relaxed">
          Fill what you know. Leave the rest empty — you can come back. The more complete your profile, the better the engine reads each deal.
        </p>
      </div>

      {/* Dimension sections */}
      <div className="space-y-2">
        {DIMENSIONS.map(def => (
          <DimensionSection
            key={def.key}
            def={def}
            values={dims[def.key] as Record<string, string>}
            onChange={(subKey, val) => handleChange(def.key, subKey, val)}
            onSave={() => handleSave(def.key)}
            saving={savingKey === def.key}
          />
        ))}
      </div>
    </div>
  )
}
