'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  type Deal, type DealRound, type BriefingQuestion, type BriefingObjection,
  LAYER_LABELS, getLayerVerdict,
} from '@/lib/types'
import RoundTimeline from '@/components/deal/RoundTimeline'

// ── Helpers ──────────────────────────────────────────────────

function SectionHeader({ label, subtitle }: { label: string; subtitle?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-stone-300 pb-2 mb-4">
      <h3 className="font-serif text-lg text-stone-900 italic">{label}</h3>
      {subtitle && <div className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">{subtitle}</div>}
    </div>
  )
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 font-mono focus:outline-none focus:border-stone-900 resize-none"
    />
  )
}

// ── Status band for the 4 layers ─────────────────────────────

function StatusBand({ layer, verdict }: { layer: number; verdict: string }) {
  const colorClass =
    verdict === 'PASS' ? 'text-emerald-800'
    : verdict === 'AT RISK' ? 'text-rose-800'
    : verdict === 'EMPTY' ? 'text-stone-400'
    : 'text-amber-800'
  return (
    <div className="border border-stone-300 bg-white p-3">
      <div className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">Layer {layer}</div>
      <div className="text-xs font-serif italic text-stone-900 mt-0.5">{LAYER_LABELS[layer]}</div>
      <div className={`text-xs font-mono mt-1 ${colorClass}`}>{verdict}</div>
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

  // Local editable state — always reflects the selected round
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
    const found = rounds.find(rd => rd.round === r) ?? null
    populateFromRound(found)
  }

  async function handleSave() {
    if (!currentRoundData) return
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('deal_rounds')
      .update({
        briefing_line: line,
        briefing_read: read,
        briefing_angle: angle,
        briefing_win_condition: winCondition,
        briefing_questions: questions,
        briefing_do_not: doNot,
        briefing_mirror: mirror,
        briefing_objections: objections,
      })
      .eq('id', currentRoundData.id)
    if (error) setError(error.message)
    else await load()
    setSaving(false)
  }

  // ── List helpers ────────────────────────────────────────────

  function addQuestion() {
    setQuestions(q => [...q, { layer: 1, variable: '', why: '', text: '' }])
  }
  function updateQuestion(i: number, field: keyof BriefingQuestion, val: string | number) {
    setQuestions(q => q.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
  }
  function removeQuestion(i: number) {
    setQuestions(q => q.filter((_, idx) => idx !== i))
  }

  function addDoNot() { setDoNot(d => [...d, '']) }
  function updateDoNot(i: number, val: string) { setDoNot(d => d.map((item, idx) => idx === i ? val : item)) }
  function removeDoNot(i: number) { setDoNot(d => d.filter((_, idx) => idx !== i)) }

  function addMirror() { setMirror(m => [...m, '']) }
  function updateMirror(i: number, val: string) { setMirror(m => m.map((item, idx) => idx === i ? val : item)) }
  function removeMirror(i: number) { setMirror(m => m.filter((_, idx) => idx !== i)) }

  function addObjection() { setObjections(o => [...o, { likely: '', frame: '' }]) }
  function updateObjection(i: number, field: 'likely' | 'frame', val: string) {
    setObjections(o => o.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
  }
  function removeObjection(i: number) { setObjections(o => o.filter((_, idx) => idx !== i)) }

  // ── Render ──────────────────────────────────────────────────

  if (!deal) {
    return <div className="max-w-4xl mx-auto py-12 px-6 text-xs font-mono text-stone-400">Loading…</div>
  }

  const nodes = rounds.map(r => ({
    round: r.round,
    created_at: r.created_at,
    roundData: r,
  }))

  const verdicts = currentRoundData
    ? [1, 2, 3, 4].map(l => getLayerVerdict(currentRoundData, l))
    : ['EMPTY', 'EMPTY', 'EMPTY', 'EMPTY']

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      {/* Header */}
      <div className="flex items-baseline justify-between pb-4 mb-6 border-b border-stone-300">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500 font-mono">
            <button onClick={() => router.push('/pipeline')} className="hover:text-stone-900 mr-2">← pipeline</button>
            {deal.prospect_name}
          </div>
          <h2 className="font-serif text-xl text-stone-900 italic mt-1">
            Briefing · {selectedRound === 0 ? 'initial' : `round ${selectedRound}`}
          </h2>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">
            {isLatestRound ? 'current round' : 'historical'}
          </div>
        </div>
      </div>

      {/* Round timeline */}
      <RoundTimeline
        nodes={nodes}
        currentRound={selectedRound}
        onSelect={handleSelectRound}
      />

      {/* Read-only notice for historical rounds */}
      {!isLatestRound && (
        <div className="mb-6 px-4 py-2 bg-stone-100 border border-stone-300 text-[11px] font-mono text-stone-500 uppercase tracking-widest">
          viewing historical briefing — read only
        </div>
      )}

      {/* The Line */}
      <section className="border-2 border-stone-900 p-6 mb-8 bg-stone-50">
        <div className="text-[10px] uppercase tracking-widest text-stone-500 font-mono mb-3">the line</div>
        {isLatestRound ? (
          <Textarea
            value={line}
            onChange={setLine}
            placeholder="One sentence that frames the entire conversation…"
            rows={2}
          />
        ) : (
          <h2 className="font-serif text-2xl text-stone-900 italic leading-snug">"{line || '—'}"</h2>
        )}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[1, 2, 3, 4].map((l, i) => (
            <StatusBand key={l} layer={l} verdict={verdicts[i]} />
          ))}
        </div>
      </section>

      {/* The Read */}
      <section className="mb-8">
        <SectionHeader label="The Read" subtitle="where the deal stands" />
        {isLatestRound ? (
          <Textarea
            value={read}
            onChange={setRead}
            placeholder="Where the deal stands, honestly. What do you know, what is missing?"
            rows={4}
          />
        ) : (
          <p className="text-sm text-stone-800 font-serif italic leading-relaxed border-l-2 border-stone-900 pl-4">{read || '—'}</p>
        )}
      </section>

      {/* The Angle */}
      <section className="mb-8">
        <SectionHeader label="The Angle" subtitle="how to walk in" />
        {isLatestRound ? (
          <Textarea
            value={angle}
            onChange={setAngle}
            placeholder="Your opening posture. How will you position yourself for this conversation?"
            rows={3}
          />
        ) : (
          <p className="text-sm text-stone-800 leading-relaxed border-l-2 border-orange-700 pl-4">{angle || '—'}</p>
        )}
      </section>

      {/* Field Questions */}
      <section className="mb-8">
        <SectionHeader label="Field Questions" subtitle="ranked" />
        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={i} className="border-l border-stone-300 pl-4">
              {isLatestRound ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <select
                      value={q.layer}
                      onChange={e => updateQuestion(i, 'layer', Number(e.target.value))}
                      className="border border-stone-300 text-xs font-mono px-2 py-1 focus:outline-none"
                    >
                      {[1, 2, 3, 4].map(l => <option key={l} value={l}>L{l}</option>)}
                    </select>
                    <input
                      value={q.variable}
                      onChange={e => updateQuestion(i, 'variable', e.target.value)}
                      placeholder="variable"
                      className="flex-1 border border-stone-300 text-xs font-mono px-2 py-1 focus:outline-none"
                    />
                    <button
                      onClick={() => removeQuestion(i)}
                      className="text-xs font-mono text-stone-400 hover:text-rose-700"
                    >
                      ×
                    </button>
                  </div>
                  <input
                    value={q.text}
                    onChange={e => updateQuestion(i, 'text', e.target.value)}
                    placeholder="The question you will ask…"
                    className="w-full border border-stone-300 text-sm font-serif italic px-3 py-1.5 focus:outline-none"
                  />
                  <input
                    value={q.why}
                    onChange={e => updateQuestion(i, 'why', e.target.value)}
                    placeholder="Why this question matters now"
                    className="w-full border border-stone-300 text-xs font-mono px-3 py-1.5 focus:outline-none text-stone-500"
                  />
                </div>
              ) : (
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-stone-400 font-mono mb-1">
                    {String(i + 1).padStart(2, '0')} · L{q.layer} · {q.variable}
                  </div>
                  <p className="text-sm text-stone-900 font-serif italic mb-1">"{q.text}"</p>
                  <p className="text-xs text-stone-500">→ {q.why}</p>
                </div>
              )}
            </div>
          ))}
        </div>
        {isLatestRound && (
          <button
            onClick={addQuestion}
            className="mt-3 text-xs uppercase tracking-widest font-mono text-stone-500 hover:text-stone-900 border border-dashed border-stone-300 px-3 py-1.5 hover:border-stone-600"
          >
            + add question
          </button>
        )}
      </section>

      {/* Mirror terms */}
      <section className="mb-8">
        <SectionHeader label="Mirror Vocabulary" subtitle="prospect's words to echo" />
        <div className="flex flex-wrap gap-2 mb-3">
          {mirror.map((term, i) => (
            isLatestRound ? (
              <div key={i} className="flex items-center gap-1 border border-stone-400 px-2 py-1 bg-white">
                <input
                  value={term}
                  onChange={e => updateMirror(i, e.target.value)}
                  className="text-xs font-mono text-stone-700 w-24 focus:outline-none bg-transparent"
                />
                <button onClick={() => removeMirror(i)} className="text-stone-400 hover:text-rose-700 text-xs">×</button>
              </div>
            ) : (
              <span key={i} className="border border-stone-400 px-2 py-1 text-xs font-mono text-stone-700 bg-white">{term}</span>
            )
          ))}
        </div>
        {isLatestRound && (
          <button
            onClick={addMirror}
            className="text-xs uppercase tracking-widest font-mono text-stone-500 hover:text-stone-900 border border-dashed border-stone-300 px-3 py-1.5 hover:border-stone-600"
          >
            + add term
          </button>
        )}
      </section>

      {/* Objections */}
      <section className="mb-8">
        <SectionHeader label="Objection Ready" subtitle="expected pushback" />
        <div className="space-y-3">
          {objections.map((o, i) => (
            <div key={i} className="border-l border-amber-700 pl-4">
              {isLatestRound ? (
                <div className="space-y-2">
                  <div className="flex gap-2 items-start">
                    <input
                      value={o.likely}
                      onChange={e => updateObjection(i, 'likely', e.target.value)}
                      placeholder="Likely objection…"
                      className="flex-1 border border-stone-300 text-sm font-serif italic px-3 py-1.5 focus:outline-none"
                    />
                    <button onClick={() => removeObjection(i)} className="text-xs font-mono text-stone-400 hover:text-rose-700 mt-1.5">×</button>
                  </div>
                  <input
                    value={o.frame}
                    onChange={e => updateObjection(i, 'frame', e.target.value)}
                    placeholder="How to reframe it"
                    className="w-full border border-stone-300 text-xs font-mono px-3 py-1.5 focus:outline-none text-stone-500"
                  />
                </div>
              ) : (
                <div>
                  <p className="text-sm text-stone-900 font-serif italic mb-1">{o.likely}</p>
                  <p className="text-xs text-stone-700">→ {o.frame}</p>
                </div>
              )}
            </div>
          ))}
        </div>
        {isLatestRound && (
          <button
            onClick={addObjection}
            className="mt-3 text-xs uppercase tracking-widest font-mono text-stone-500 hover:text-stone-900 border border-dashed border-stone-300 px-3 py-1.5 hover:border-stone-600"
          >
            + add objection
          </button>
        )}
      </section>

      {/* Do Not */}
      <section className="mb-8">
        <SectionHeader label="Do Not" subtitle="avoid in this conversation" />
        <div className="space-y-2">
          {doNot.map((item, i) => (
            <div key={i} className="border-l border-rose-700 pl-4 flex gap-2 items-center">
              {isLatestRound ? (
                <>
                  <input
                    value={item}
                    onChange={e => updateDoNot(i, e.target.value)}
                    placeholder="Something to avoid…"
                    className="flex-1 border border-stone-300 text-sm px-3 py-1.5 focus:outline-none"
                  />
                  <button onClick={() => removeDoNot(i)} className="text-xs font-mono text-stone-400 hover:text-rose-700">×</button>
                </>
              ) : (
                <p className="text-sm text-stone-700">{item}</p>
              )}
            </div>
          ))}
        </div>
        {isLatestRound && (
          <button
            onClick={addDoNot}
            className="mt-3 text-xs uppercase tracking-widest font-mono text-rose-700 hover:text-rose-900 border border-dashed border-rose-300 px-3 py-1.5 hover:border-rose-600"
          >
            + add item
          </button>
        )}
      </section>

      {/* Win Condition */}
      <section className="mb-8 border-t border-stone-300 pt-6">
        <SectionHeader label="Win Condition" subtitle="what success looks like after this round" />
        {isLatestRound ? (
          <Textarea
            value={winCondition}
            onChange={setWinCondition}
            placeholder="What specific outcome would make this conversation a success?"
            rows={2}
          />
        ) : (
          <p className="text-sm text-stone-800 leading-relaxed border-l-2 border-emerald-800 pl-4">{winCondition || '—'}</p>
        )}
      </section>

      {/* Save */}
      {isLatestRound && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-stone-900 text-stone-50 px-6 py-3 text-sm uppercase tracking-widest font-mono hover:bg-stone-800 disabled:opacity-40"
          >
            {saving ? 'saving…' : 'save briefing'}
          </button>
          {error && <span className="text-xs font-mono text-rose-700">{error}</span>}
        </div>
      )}
    </div>
  )
}
