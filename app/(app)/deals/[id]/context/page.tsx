'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { type Deal, type Stakeholder, type ProspectDimensions, EMPTY_PROSPECT_DIMENSIONS } from '@/lib/types'

// ── Prospect dimension definitions ───────────────────────────

type SubQ = { key: string; label: string; hint: string }
type DimDef = { key: keyof ProspectDimensions; label: string; questions: SubQ[] }

const DIMENSIONS: DimDef[] = [
  {
    key: 'company', label: '1 · Company',
    questions: [
      { key: 'core_business', label: 'Core business', hint: 'What they do, their main product or service, business model.' },
      { key: 'industry', label: 'Industry & market', hint: 'Sector, competitive environment, market they operate in.' },
      { key: 'size_stage', label: 'Size & stage', hint: 'Headcount, revenue signals, growth phase, funding status.' },
      { key: 'geography', label: 'Geography', hint: 'HQ, regions, markets served, operating model.' },
    ],
  },
  {
    key: 'strategic_context', label: '2 · Strategic Context',
    questions: [
      { key: 'priorities', label: 'Strategic priorities', hint: 'What they are focused on — growth, efficiency, compliance, transformation.' },
      { key: 'challenges', label: 'Known challenges', hint: 'Operational pain points, recurring problems, friction areas.' },
      { key: 'recent_signals', label: 'Recent signals', hint: 'News, announcements, leadership changes, new initiatives.' },
      { key: 'pressures', label: 'Pressures', hint: 'Regulatory, competitive, financial, or market pressures.' },
    ],
  },
  {
    key: 'buying_environment', label: '3 · Buying Environment',
    questions: [
      { key: 'decision_process', label: 'Decision process', hint: 'How buying decisions are made, approval layers, stakeholders involved.' },
      { key: 'budget_signals', label: 'Budget signals', hint: 'Budget cycle, existing tools spend, procurement style.' },
      { key: 'timeline', label: 'Timeline', hint: 'Known deadlines, board commitments, fiscal pressures, urgency triggers.' },
      { key: 'history', label: 'History with similar solutions', hint: 'Have they tried before? Switched vendors? Failed implementations?' },
    ],
  },
  {
    key: 'key_contact', label: '4 · Key Contact',
    questions: [
      { key: 'role_accountability', label: 'Role & accountability', hint: 'What they own, what they are measured on, what keeps them up at night.' },
      { key: 'background', label: 'Background', hint: 'Career history, domain expertise, how long in role.' },
      { key: 'personal_priorities', label: 'Personal priorities', hint: 'What they care about given their position — visibility, risk, performance.' },
      { key: 'influence_level', label: 'Influence level', hint: 'Their authority in the buying process — champion, gatekeeper, decision maker?' },
    ],
  },
  {
    key: 'fit_signals', label: '5 · Fit Signals',
    questions: [
      { key: 'problem_mapping', label: 'Problem mapping', hint: 'Which of their problems map to what you solve?' },
      { key: 'implementation_readiness', label: 'Implementation readiness', hint: 'Org capacity, tech stack, change tolerance, bandwidth.' },
      { key: 'timing_trigger', label: 'Timing trigger', hint: 'Is there a real trigger for action now? What makes this urgent?' },
    ],
  },
]

const ACTOR_LABELS: Record<string, string> = {
  champion: 'Champion', decision_maker: 'Decision Maker', user: 'End User',
  reviewer: 'Reviewer', blocker: 'Blocker', unknown: 'Unknown',
}

function filledCount(dim: Record<string, string>) {
  return Object.values(dim).filter(v => v.trim().length > 0).length
}

function deepMerge(base: ProspectDimensions, saved: Partial<ProspectDimensions>): ProspectDimensions {
  const result = { ...base }
  for (const key of Object.keys(saved) as (keyof ProspectDimensions)[]) {
    if (saved[key]) result[key] = { ...base[key], ...saved[key] } as never
  }
  return result
}

// ── Dimension section ────────────────────────────────────────

function DimensionSection({
  def, values, onChange, onSave, saving,
}: {
  def: DimDef
  values: Record<string, string>
  onChange: (key: string, val: string) => void
  onSave: () => void
  saving: boolean
}) {
  const [open, setOpen] = useState(false)
  const filled = filledCount(values)
  const total = def.questions.length

  return (
    <div className="border border-stone-300 bg-white">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-stone-50 transition-colors"
      >
        <span className="font-serif italic text-stone-900 text-base">{def.label}</span>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] uppercase tracking-widest font-mono ${filled === total ? 'text-emerald-700' : filled > 0 ? 'text-amber-700' : 'text-stone-400'}`}>
            {filled}/{total}
          </span>
          <span className="text-stone-400 font-mono text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-stone-200 px-5 py-5 space-y-5">
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
          <div className="pt-4 border-t border-stone-200">
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

export default function AccountContextPage() {
  const params = useParams()
  const router = useRouter()
  const dealId = params.id as string

  const [deal, setDeal] = useState<Deal | null>(null)
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([])
  const [dims, setDims] = useState<ProspectDimensions>(EMPTY_PROSPECT_DIMENSIONS)
  const [savingDim, setSavingDim] = useState<string | null>(null)
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState<string | null>(null)

  // Stakeholder form
  const [newStk, setNewStk] = useState({ name: '', role: '', actor_type: 'unknown' as Stakeholder['actor_type'], notes: '' })
  const [addingStk, setAddingStk] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [{ data: dealData }, { data: stkData }] = await Promise.all([
      supabase.from('deals').select('*').eq('id', dealId).single(),
      supabase.from('deal_stakeholders').select('*').eq('deal_id', dealId).order('created_at', { ascending: true }),
    ])
    if (dealData) {
      setDeal(dealData)
      setDims(deepMerge(EMPTY_PROSPECT_DIMENSIONS, dealData.prospect_dimensions ?? {}))
    }
    if (stkData) setStakeholders(stkData)
  }, [dealId])

  useEffect(() => { load() }, [load])

  function handleChange(dimKey: keyof ProspectDimensions, subKey: string, val: string) {
    setDims(d => ({ ...d, [dimKey]: { ...d[dimKey], [subKey]: val } }))
  }

  async function handleSaveDim(dimKey: keyof ProspectDimensions) {
    if (!deal) return
    setSavingDim(dimKey)
    const supabase = createClient()
    const merged = { ...(deal.prospect_dimensions ?? {}), [dimKey]: dims[dimKey] }
    await supabase.from('deals').update({ prospect_dimensions: merged }).eq('id', dealId)
    await load()
    setSavingDim(null)
  }

  async function handleScrape() {
    if (!deal?.prospect_url) return
    setScraping(true)
    setScrapeError(null)
    try {
      const res = await fetch('/api/context/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: deal.prospect_url }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setScrapeError(data.error ?? 'Failed'); setScraping(false); return }

      const { extracted } = data
      // Pre-fill company + strategic_context dims from extracted data
      setDims(d => ({
        ...d,
        company: {
          core_business: extracted.core_business || d.company.core_business,
          industry: extracted.industry || d.company.industry,
          size_stage: extracted.size_stage || d.company.size_stage,
          geography: extracted.geography || d.company.geography,
        },
        strategic_context: {
          priorities: extracted.priorities || d.strategic_context.priorities,
          challenges: extracted.challenges || d.strategic_context.challenges,
          recent_signals: extracted.recent_signals || d.strategic_context.recent_signals,
          pressures: extracted.pressures || d.strategic_context.pressures,
        },
      }))
    } catch {
      setScrapeError('Network error — try again')
    }
    setScraping(false)
  }

  async function handleAddStakeholder() {
    if (!newStk.name) return
    setAddingStk(true)
    const supabase = createClient()
    await supabase.from('deal_stakeholders').insert({
      deal_id: dealId, name: newStk.name,
      role: newStk.role || null, actor_type: newStk.actor_type, notes: newStk.notes || null,
    })
    setNewStk({ name: '', role: '', actor_type: 'unknown', notes: '' })
    await load()
    setAddingStk(false)
  }

  async function handleDeleteStakeholder(id: string) {
    const supabase = createClient()
    await supabase.from('deal_stakeholders').delete().eq('id', id)
    await load()
  }

  if (!deal) return <div className="max-w-4xl mx-auto py-12 px-6 text-xs font-mono text-stone-400">Loading…</div>

  const totalFilled = DIMENSIONS.reduce((acc, d) => acc + filledCount(dims[d.key] as Record<string, string>), 0)
  const totalQ = DIMENSIONS.reduce((acc, d) => acc + d.questions.length, 0)

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      {/* Header */}
      <div className="flex items-baseline justify-between pb-4 mb-8 border-b border-stone-300">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500 font-mono">
            <button onClick={() => router.push('/pipeline')} className="hover:text-stone-900 mr-2">← pipeline</button>
            {deal.prospect_name}
          </div>
          <h2 className="font-serif text-xl text-stone-900 italic mt-1">Account context</h2>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">context completion</div>
          <div className={`font-mono text-lg mt-0.5 ${totalFilled === totalQ ? 'text-emerald-800' : totalFilled > 0 ? 'text-amber-700' : 'text-stone-400'}`}>
            {totalFilled}/{totalQ}
          </div>
        </div>
      </div>

      {/* Fetch from website */}
      {deal.prospect_url && (
        <div className="mb-8 flex items-center gap-4 p-4 border border-dashed border-stone-300 bg-stone-50">
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-widest text-stone-500 font-mono mb-0.5">auto-fill from website</div>
            <div className="text-xs font-mono text-stone-700">{deal.prospect_url}</div>
          </div>
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="px-4 py-2 border border-stone-900 text-stone-900 text-xs uppercase tracking-widest font-mono hover:bg-stone-900 hover:text-stone-50 disabled:opacity-40 flex-shrink-0"
          >
            {scraping ? 'fetching…' : '↓ fetch context'}
          </button>
          {scrapeError && <span className="text-xs font-mono text-rose-700">{scrapeError}</span>}
        </div>
      )}

      {/* Prospect dimensions */}
      <section className="mb-10">
        <div className="text-[10px] uppercase tracking-widest text-stone-500 font-mono mb-3">prospect profile</div>
        <div className="space-y-2">
          {DIMENSIONS.map(def => (
            <DimensionSection
              key={def.key}
              def={def}
              values={dims[def.key] as Record<string, string>}
              onChange={(subKey, val) => handleChange(def.key, subKey, val)}
              onSave={() => handleSaveDim(def.key)}
              saving={savingDim === def.key}
            />
          ))}
        </div>
      </section>

      {/* Stakeholder ecosystem */}
      <section>
        <div className="flex items-baseline justify-between border-b border-stone-300 pb-2 mb-4">
          <h3 className="font-serif text-lg text-stone-900 italic">Stakeholder ecosystem</h3>
          <div className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">{stakeholders.length} identified</div>
        </div>

        {stakeholders.length === 0 && (
          <p className="text-xs text-stone-400 font-mono mb-4">No stakeholders added yet.</p>
        )}

        <div className="space-y-3 mb-6">
          {stakeholders.map(s => (
            <div key={s.id} className="border-l border-stone-300 pl-4 group">
              <div className="flex items-baseline justify-between">
                <h5 className="font-serif italic text-stone-900">{s.name}</h5>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">{ACTOR_LABELS[s.actor_type]}</span>
                  {s.role && <span className="text-[10px] text-stone-400 font-mono">{s.role}</span>}
                  <button
                    onClick={() => handleDeleteStakeholder(s.id)}
                    className="text-[10px] font-mono text-stone-300 hover:text-rose-700 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    remove
                  </button>
                </div>
              </div>
              {s.notes && <p className="text-xs text-stone-700 mt-1 leading-relaxed">{s.notes}</p>}
            </div>
          ))}
        </div>

        {/* Add stakeholder */}
        <div className="border border-dashed border-stone-300 p-4">
          <div className="text-[10px] uppercase tracking-widest text-stone-500 font-mono mb-3">Add stakeholder</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input value={newStk.name} onChange={e => setNewStk(n => ({ ...n, name: e.target.value }))} placeholder="Name"
              className="border border-stone-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-stone-900" />
            <input value={newStk.role} onChange={e => setNewStk(n => ({ ...n, role: e.target.value }))} placeholder="Title / Role"
              className="border border-stone-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-stone-900" />
          </div>
          <select value={newStk.actor_type} onChange={e => setNewStk(n => ({ ...n, actor_type: e.target.value as Stakeholder['actor_type'] }))}
            className="border border-stone-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-stone-900 w-full mb-3">
            {Object.entries(ACTOR_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>
          <textarea value={newStk.notes} onChange={e => setNewStk(n => ({ ...n, notes: e.target.value }))} rows={2}
            placeholder="Notes — position, motivations, influence?"
            className="w-full border border-stone-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-stone-900 resize-none mb-3" />
          <button onClick={handleAddStakeholder} disabled={addingStk || !newStk.name}
            className="px-4 py-2 border border-stone-900 text-stone-900 text-xs uppercase tracking-widest font-mono hover:bg-stone-900 hover:text-stone-50 disabled:opacity-40">
            {addingStk ? 'adding…' : '+ add'}
          </button>
        </div>
      </section>
    </div>
  )
}
