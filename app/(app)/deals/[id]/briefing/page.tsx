'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  type Deal, type DealRound, type BriefingQuestion, type BriefingObjection,
  LAYER_LABELS, getLayerVerdict,
} from '@/lib/types'
import RoundTimeline from '@/components/deal/RoundTimeline'

// ── Collapsible section ─────────────────────────────────────

function Section({ title, subtitle, defaultOpen = true, accent, children }: {
  title: string; subtitle?: string; defaultOpen?: boolean; accent?: string; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm mb-5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-neutral-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {accent && <span className={`w-1 h-6 rounded-full ${accent}`} />}
          <div>
            <h3 className="text-base font-semibold text-neutral-800">{title}</h3>
            {subtitle && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <span className={`text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && <div className="px-6 pb-5 border-t border-neutral-100 pt-4">{children}</div>}
    </div>
  )
}

// ── Status band for the 4 layers ────────────────────────────

const LAYER_BAND_COLORS: Record<number, string> = { 1: 'bg-orange-500', 2: 'bg-blue-500', 3: 'bg-violet-500', 4: 'bg-cyan-500' }

function StatusBand({ layer, verdict }: { layer: number; verdict: string }) {
  const verdictStyle = verdict === 'PASS'
    ? 'text-emerald-600 bg-emerald-50'
    : verdict === 'AT RISK'
      ? 'text-rose-600 bg-rose-50'
      : verdict === 'EMPTY'
        ? 'text-neutral-400 bg-neutral-50'
        : 'text-amber-600 bg-amber-50'
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-3 text-center">
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <span className={`w-1.5 h-1.5 rounded-full ${LAYER_BAND_COLORS[layer]}`} />
        <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">L{layer}</span>
      </div>
      <div className="text-xs font-medium text-neutral-700">{LAYER_LABELS[layer]}</div>
      <span className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${verdictStyle}`}>{verdict}</span>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────

export default function BriefingPage() {
  const params = useParams()
  const router = useRouter()
  const dealId = params.id as string

  const [deal, setDeal] = useState<Deal | null>(null)
  const [rounds, setRounds] = useState<DealRound[]>([])
  const [selectedRound, setSelectedRound] = useState<number>(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [line, setLine] = useState('')
  const [read, setRead] = useState('')
  const [angle, setAngle] = useState('')
  const [winCondition, setWinCondition] = useState('')
  const [questions, setQuestions] = useState<BriefingQuestion[]>([])
  const [doNot, setDoNot] = useState<string[]>([])
  const [mirror, setMirror] = useState<string[]>([])
  const [objections, setObjections] = useState<BriefingObjection[]>([])

  const currentRoundData = rounds.find(r => r.round === selectedRound) ?? null
  const isLatestRound = deal ? selectedRound === deal.current_round : false

  function populateFromRound(r: DealRound | null) {
    setLine(r?.briefing_line ?? '')
    setRead(r?.briefing_read ?? '')
    setAngle(r?.briefing_angle ?? '')
    setWinCondition(r?.briefing_win_condition ?? '')
    setQuestions(r?.briefing_questions ?? [])
    setDoNot(r?.briefing_do_not ?? [])
    setMirror(r?.briefing_mirror ?? [])
    setObjections(r?.briefing_objections ?? [])
  }

  const load = useCallback(async () => {
    const supabase = createClient()
    const [{ data: dealData }, { data: roundData }] = await Promise.all([
      supabase.from('deals').select('*').eq('id', dealId).single(),
      supabase.from('deal_rounds').select('*').eq('deal_id', dealId).order('round', { ascending: true }),
    ])
    if (dealData) setDeal(dealData)
    if (roundData) {
      setRounds(roundData)
      const latest = roundData[roundData.length - 1]
      if (latest) {
        setSelectedRound(latest.round)
        populateFromRound(latest)
      }
    }
  }, [dealId])

  useEffect(() => { load() }, [load])

  function handleSelectRound(r: number) {
    setSelectedRound(r)
    populateFromRound(rounds.find(rd => rd.round === r) ?? null)
  }

  async function handleSave() {
    if (!currentRoundData) return
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('deal_rounds')
      .update({
        briefing_line: line, briefing_read: read, briefing_angle: angle,
        briefing_win_condition: winCondition, briefing_questions: questions,
        briefing_do_not: doNot, briefing_mirror: mirror, briefing_objections: objections,
      })
      .eq('id', currentRoundData.id)
    if (error) setError(error.message)
    else await load()
    setSaving(false)
  }

  // ── List helpers ──────────────────────────────────────────

  function addQuestion() {
    setQuestions(q => [...q, { layer: 1, variable: '', intent: '', text: '', sub_questions: [], priority: 'pressing' as const }])
  }
  function updateQuestion(i: number, field: keyof BriefingQuestion, val: string | number | string[]) {
    setQuestions(q => q.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
  }
  function removeQuestion(i: number) { setQuestions(q => q.filter((_, idx) => idx !== i)) }
  function updateSubQuestion(qi: number, si: number, val: string) {
    setQuestions(q => q.map((item, idx) => idx === qi
      ? { ...item, sub_questions: item.sub_questions.map((s, sidx) => sidx === si ? val : s) }
      : item))
  }
  function addSubQuestion(qi: number) {
    setQuestions(q => q.map((item, idx) => idx === qi
      ? { ...item, sub_questions: [...(item.sub_questions ?? []), ''] }
      : item))
  }
  function removeSubQuestion(qi: number, si: number) {
    setQuestions(q => q.map((item, idx) => idx === qi
      ? { ...item, sub_questions: item.sub_questions.filter((_, sidx) => sidx !== si) }
      : item))
  }

  function addDoNot() { setDoNot(d => [...d, '']) }
  function updateDoNot(i: number, val: string) { setDoNot(d => d.map((item, idx) => idx === i ? val : item)) }
  function removeDoNot(i: number) { setDoNot(d => d.filter((_, idx) => idx !== i)) }


  function addObjection() { setObjections(o => [...o, { likely: '', frame: '' }]) }
  function updateObjection(i: number, field: 'likely' | 'frame', val: string) {
    setObjections(o => o.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
  }
  function removeObjection(i: number) { setObjections(o => o.filter((_, idx) => idx !== i)) }

  // ── Render ────────────────────────────────────────────────

  if (!deal) {
    return <div className="max-w-4xl mx-auto py-12 px-6 text-sm text-neutral-400">Loading…</div>
  }

  const nodes = rounds.map(r => ({ round: r.round, created_at: r.created_at, roundData: r }))
  const verdicts = currentRoundData
    ? [1, 2, 3, 4].map(l => getLayerVerdict(currentRoundData, l))
    : ['EMPTY', 'EMPTY', 'EMPTY', 'EMPTY']

  const inputClass = "w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none placeholder:text-neutral-300 transition-all"

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <button onClick={() => router.push('/pipeline')} className="text-sm text-neutral-400 hover:text-blue-500 transition-colors mb-1 block">
            ← Back to pipeline
          </button>
          <h1 className="text-2xl font-bold text-neutral-900">
            Briefing · <span className="text-neutral-400 font-normal">{deal.prospect_name}</span>
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Round {selectedRound === 0 ? '0 (initial)' : selectedRound}
          </p>
        </div>
        <div className="flex items-center gap-3" />
      </div>

      {/* Round timeline */}
      <RoundTimeline nodes={nodes} currentRound={selectedRound} onSelect={handleSelectRound} />

      {/* Historical notice */}
      {!isLatestRound && (
        <div className="mb-5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 font-medium">
          Viewing historical briefing — read only
        </div>
      )}

      {/* The Line */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-6 mb-5 text-white shadow-lg shadow-blue-500/20">
        <div className="text-xs font-semibold uppercase tracking-wide text-blue-200 mb-3">The Line</div>
        {isLatestRound ? (
          <textarea
            value={line}
            onChange={e => setLine(e.target.value)}
            placeholder="One sentence that frames the entire conversation…"
            rows={2}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-lg placeholder:text-blue-200 focus:outline-none focus:ring-2 focus:ring-white/30 resize-none"
          />
        ) : (
          <p className="text-xl font-medium leading-snug">"{line || '—'}"</p>
        )}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[1, 2, 3, 4].map((l, i) => (
            <StatusBand key={l} layer={l} verdict={verdicts[i]} />
          ))}
        </div>
      </div>

      {/* The Read */}
      <Section title="The Read" subtitle="Where the deal stands" accent="bg-neutral-400" defaultOpen={true}>
        {isLatestRound ? (
          <textarea
            value={read}
            onChange={e => { setRead(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
            ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
            placeholder="Where the deal stands, honestly. What do you know, what is missing?"
            className={inputClass + ' overflow-hidden'}
          />
        ) : (
          <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">{read || '—'}</p>
        )}
      </Section>

      {/* The Angle */}
      <Section title="The Angle" subtitle="What needs to be accomplished" accent="bg-orange-400" defaultOpen={false}>
        {isLatestRound ? (
          <textarea
            value={angle}
            onChange={e => { setAngle(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
            ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
            placeholder="The diagnostic objective — what must be resolved in this conversation."
            className={inputClass + ' overflow-hidden'}
          />
        ) : (
          <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">{angle || '—'}</p>
        )}
      </Section>

      {/* Field Questions */}
      <Section title="Field Questions" subtitle="Sequential by diagnostic layer" accent="bg-violet-400" defaultOpen={false}>
        {/* Pressing */}
        {questions.filter(q => q.priority !== 'opportunistic').length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-neutral-800" />
              <span className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">Pressing — must ask this round</span>
            </div>
            <div className="space-y-4">
              {questions.map((q, i) => q.priority === 'opportunistic' ? null : (
                <div key={i} className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  {isLatestRound ? (
                    <div className="space-y-2.5">
                      <div className="flex gap-2">
                        <select value={q.layer} onChange={e => updateQuestion(i, 'layer', Number(e.target.value))} className="bg-white border border-neutral-200 text-xs font-medium px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                          {[1, 2, 3, 4].map(l => <option key={l} value={l}>L{l}</option>)}
                        </select>
                        <input value={q.variable} onChange={e => updateQuestion(i, 'variable', e.target.value)} placeholder="variable" className="flex-1 bg-white border border-neutral-200 text-xs font-medium px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                        <select value={q.priority} onChange={e => updateQuestion(i, 'priority', e.target.value)} className="bg-white border border-neutral-200 text-xs font-medium px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                          <option value="pressing">pressing</option>
                          <option value="opportunistic">opportunistic</option>
                        </select>
                        <button onClick={() => removeQuestion(i)} className="text-neutral-300 hover:text-rose-500 transition-colors">✕</button>
                      </div>
                      <input value={q.intent ?? ''} onChange={e => updateQuestion(i, 'intent', e.target.value)} placeholder="Intent — what are you trying to establish?" className="w-full bg-amber-50 border border-amber-200 text-xs px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-amber-800 italic placeholder:text-amber-300" />
                      <input value={q.text} onChange={e => updateQuestion(i, 'text', e.target.value)} placeholder="Main question…" className="w-full bg-white border border-neutral-200 text-sm px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium" />
                      <div className="pl-4 space-y-1.5">
                        {(q.sub_questions ?? []).map((sq, si) => (
                          <div key={si} className="flex gap-1.5 items-center">
                            <span className="text-neutral-300 text-xs">↳</span>
                            <input value={sq} onChange={e => updateSubQuestion(i, si, e.target.value)} placeholder="Sub-question…" className="flex-1 bg-white border border-neutral-200 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none text-neutral-600" />
                            <button onClick={() => removeSubQuestion(i, si)} className="text-neutral-300 hover:text-rose-500 text-xs transition-colors">✕</button>
                          </div>
                        ))}
                        <button onClick={() => addSubQuestion(i)} className="text-[11px] font-medium text-neutral-400 hover:text-blue-500 transition-colors">+ sub-question</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">L{q.layer} · {q.variable}</span>
                      </div>
                      {q.intent && <p className="text-xs text-amber-700 italic mb-2 bg-amber-50 px-3 py-1.5 rounded-lg inline-block">→ {q.intent}</p>}
                      <p className="text-sm text-neutral-800 font-medium mb-2">"{q.text}"</p>
                      {(q.sub_questions ?? []).length > 0 && (
                        <ul className="space-y-1 pl-3">
                          {q.sub_questions.map((sq, si) => (
                            <li key={si} className="text-xs text-neutral-500 flex items-start gap-1.5"><span className="text-neutral-300">↳</span>{sq}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Opportunistic */}
        {questions.filter(q => q.priority === 'opportunistic').length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full border-2 border-neutral-300" />
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Opportunistic — if the door opens</span>
            </div>
            <div className="space-y-4">
              {questions.map((q, i) => q.priority !== 'opportunistic' ? null : (
                <div key={i} className="bg-neutral-50/50 rounded-xl p-4 border border-dashed border-neutral-200">
                  {isLatestRound ? (
                    <div className="space-y-2.5">
                      <div className="flex gap-2">
                        <select value={q.layer} onChange={e => updateQuestion(i, 'layer', Number(e.target.value))} className="bg-white border border-neutral-200 text-xs font-medium px-2.5 py-1.5 rounded-lg focus:outline-none">
                          {[1, 2, 3, 4].map(l => <option key={l} value={l}>L{l}</option>)}
                        </select>
                        <input value={q.variable} onChange={e => updateQuestion(i, 'variable', e.target.value)} placeholder="variable" className="flex-1 bg-white border border-neutral-200 text-xs font-medium px-2.5 py-1.5 rounded-lg focus:outline-none" />
                        <select value={q.priority} onChange={e => updateQuestion(i, 'priority', e.target.value)} className="bg-white border border-neutral-200 text-xs font-medium px-2.5 py-1.5 rounded-lg focus:outline-none">
                          <option value="pressing">pressing</option>
                          <option value="opportunistic">opportunistic</option>
                        </select>
                        <button onClick={() => removeQuestion(i)} className="text-neutral-300 hover:text-rose-500 transition-colors">✕</button>
                      </div>
                      <input value={q.intent ?? ''} onChange={e => updateQuestion(i, 'intent', e.target.value)} placeholder="Intent…" className="w-full bg-amber-50/50 border border-amber-100 text-xs px-3 py-2 rounded-lg focus:outline-none text-amber-700 italic placeholder:text-amber-200" />
                      <input value={q.text} onChange={e => updateQuestion(i, 'text', e.target.value)} placeholder="Main question…" className="w-full bg-white border border-neutral-200 text-sm px-3 py-2.5 rounded-lg focus:outline-none text-neutral-600" />
                      <div className="pl-4 space-y-1.5">
                        {(q.sub_questions ?? []).map((sq, si) => (
                          <div key={si} className="flex gap-1.5 items-center">
                            <span className="text-neutral-300 text-xs">↳</span>
                            <input value={sq} onChange={e => updateSubQuestion(i, si, e.target.value)} placeholder="Sub-question…" className="flex-1 bg-white border border-neutral-200 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none text-neutral-500" />
                            <button onClick={() => removeSubQuestion(i, si)} className="text-neutral-300 hover:text-rose-500 text-xs transition-colors">✕</button>
                          </div>
                        ))}
                        <button onClick={() => addSubQuestion(i)} className="text-[11px] font-medium text-neutral-400 hover:text-blue-500 transition-colors">+ sub-question</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-2">L{q.layer} · {q.variable}</div>
                      {q.intent && <p className="text-xs text-amber-600 italic mb-2">→ {q.intent}</p>}
                      <p className="text-sm text-neutral-600 mb-2">"{q.text}"</p>
                      {(q.sub_questions ?? []).length > 0 && (
                        <ul className="space-y-1 pl-3">
                          {q.sub_questions.map((sq, si) => (
                            <li key={si} className="text-xs text-neutral-400 flex items-start gap-1.5"><span className="text-neutral-300">↳</span>{sq}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {isLatestRound && (
          <button onClick={addQuestion} className="text-sm font-medium text-blue-500 hover:text-blue-600 transition-colors">
            + Add question
          </button>
        )}
      </Section>

      {/* Objections */}
      <Section title="Objection Ready" subtitle="Expected pushback" accent="bg-amber-400" defaultOpen={false}>
        <div className="space-y-3">
          {objections.map((o, i) => (
            <div key={i} className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              {isLatestRound ? (
                <div className="space-y-2">
                  <div className="flex gap-2 items-start">
                    <input
                      value={o.likely}
                      onChange={e => updateObjection(i, 'likely', e.target.value)}
                      placeholder="Likely objection…"
                      className="flex-1 bg-white border border-amber-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-medium"
                    />
                    <button onClick={() => removeObjection(i)} className="text-amber-300 hover:text-rose-500 transition-colors mt-2">✕</button>
                  </div>
                  <input
                    value={o.frame}
                    onChange={e => updateObjection(i, 'frame', e.target.value)}
                    placeholder="How to reframe it"
                    className="w-full bg-white border border-amber-200 text-xs px-3 py-2 rounded-lg focus:outline-none text-neutral-600"
                  />
                </div>
              ) : (
                <div>
                  <p className="text-sm text-neutral-800 font-medium mb-1">{o.likely}</p>
                  <p className="text-xs text-amber-700">→ {o.frame}</p>
                </div>
              )}
            </div>
          ))}
        </div>
        {isLatestRound && (
          <button onClick={addObjection} className="mt-3 text-sm font-medium text-blue-500 hover:text-blue-600 transition-colors">+ Add objection</button>
        )}
      </Section>

      {/* Do Not */}
      <Section title="Do Not" subtitle="Avoid in this conversation" accent="bg-rose-400" defaultOpen={false}>
        <div className="space-y-2">
          {doNot.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" />
              {isLatestRound ? (
                <>
                  <input
                    value={item}
                    onChange={e => updateDoNot(i, e.target.value)}
                    placeholder="Something to avoid…"
                    className="flex-1 bg-rose-50 border border-rose-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                  <button onClick={() => removeDoNot(i)} className="text-rose-300 hover:text-rose-500 transition-colors">✕</button>
                </>
              ) : (
                <p className="text-sm text-neutral-700">{item}</p>
              )}
            </div>
          ))}
        </div>
        {isLatestRound && (
          <button onClick={addDoNot} className="mt-3 text-sm font-medium text-blue-500 hover:text-blue-600 transition-colors">+ Add item</button>
        )}
      </Section>

      {/* Win Condition */}
      <Section title="Win Condition" subtitle="What success looks like after this round" accent="bg-emerald-400" defaultOpen={false}>
        {isLatestRound ? (
          <textarea
            value={winCondition}
            onChange={e => { setWinCondition(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
            ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
            placeholder="What specific outcome would make this conversation a success?"
            className={inputClass + ' overflow-hidden'}
          />
        ) : (
          <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">{winCondition || '—'}</p>
        )}
      </Section>

      {/* Save */}
      {isLatestRound && (
        <div className="flex items-center gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 disabled:opacity-40 transition-all"
          >
            {saving ? 'Saving…' : 'Save briefing'}
          </button>
          <button
            onClick={() => router.push(`/deals/${dealId}/capture`)}
            className="px-6 py-3 bg-white text-neutral-700 text-sm font-medium rounded-xl border border-neutral-200 hover:border-neutral-400 hover:shadow-sm transition-all"
          >
            → Go to capture
          </button>
          {error && <span className="text-sm text-rose-600">{error}</span>}
        </div>
      )}
    </div>
  )
}
