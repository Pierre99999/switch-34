'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { type Deal, type DealRound, type BriefingQuestion } from '@/lib/types'
import RoundTimeline from '@/components/deal/RoundTimeline'

export default function CapturePage() {
  const params = useParams()
  const router = useRouter()
  const dealId = params.id as string

  const [deal, setDeal] = useState<Deal | null>(null)
  const [rounds, setRounds] = useState<DealRound[]>([])
  const [selectedRound, setSelectedRound] = useState<number>(0)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [freeNote, setFreeNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestingScores, setSuggestingScores] = useState(false)

  const currentRoundData = rounds.find(r => r.round === selectedRound) ?? null
  const isLatestRound = deal ? selectedRound === deal.current_round : false

  const questions: BriefingQuestion[] = currentRoundData?.briefing_questions ?? []

  function populateFromRound(r: DealRound | null) {
    setNotes(r?.capture_notes ?? {})
    setFreeNote((r?.capture_notes as Record<string, string>)?.__free__ ?? '')
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

  function setNote(key: string, val: string) {
    setNotes(n => ({ ...n, [key]: val }))
  }

  async function handleSave() {
    if (!currentRoundData) return
    setSaving(true)
    setError(null)
    const merged = { ...notes, __free__: freeNote }
    const supabase = createClient()
    const { error } = await supabase
      .from('deal_rounds')
      .update({ capture_notes: merged })
      .eq('id', currentRoundData.id)
    if (error) setError(error.message)
    else await load()
    setSaving(false)
  }

  async function handleAnalyze() {
    if (!currentRoundData) return
    setSuggestingScores(true)
    setError(null)
    try {
      // Save capture notes first
      const merged = { ...notes, __free__: freeNote }
      console.log('[capture] saving notes:', JSON.stringify(merged).slice(0, 500))
      const supabase = createClient()
      const { error: saveErr } = await supabase
        .from('deal_rounds')
        .update({ capture_notes: merged })
        .eq('id', currentRoundData.id)
      if (saveErr) throw new Error(saveErr.message)

      const res = await fetch('/api/ai/suggest-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, roundId: currentRoundData.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'AI error')

      const suggestions: Record<string, { score: number; evidence: string; rationale: string }> = data.suggestions
      const scoreUpdate: Record<string, number> = {}
      const evidenceLevels: Record<string, string> = { ...(currentRoundData.evidence_levels ?? {}) }
      for (const [variable, s] of Object.entries(suggestions)) {
        if (s.score !== null) scoreUpdate[variable] = s.score
        if (s.evidence) evidenceLevels[variable] = s.evidence
      }
      const { error: updateErr } = await supabase.from('deal_rounds').update({ ...scoreUpdate, evidence_levels: evidenceLevels }).eq('id', currentRoundData.id)
      if (updateErr) throw new Error(updateErr.message)

      fetch('/api/ai/update-boxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, roundId: currentRoundData.id }),
      }).catch(() => {})

      router.push(`/deals/${dealId}/dashboard`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to analyze')
      setSuggestingScores(false)
    }
  }

  if (!deal) {
    return <div className="max-w-4xl mx-auto py-12 px-6 text-sm text-neutral-400">Loading…</div>
  }

  const hasBriefing = !!(currentRoundData?.briefing_line)
  const nodes = rounds.map(r => ({ round: r.round, created_at: r.created_at, roundData: r }))

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
            Capture · <span className="text-neutral-400 font-normal">{deal.prospect_name}</span>
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Round {selectedRound === 0 ? '0 (initial)' : selectedRound}
          </p>
        </div>
      </div>

      {/* Round timeline */}
      <RoundTimeline nodes={nodes} currentRound={selectedRound} onSelect={handleSelectRound} />

      {/* Historical notice */}
      {!isLatestRound && (
        <div className="mb-5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 font-medium">
          Viewing historical capture — read only
        </div>
      )}

      {/* Briefing required blocker */}
      {isLatestRound && !hasBriefing && (
        <div className="mb-8 bg-white rounded-2xl border-2 border-dashed border-neutral-200 p-10 text-center">
          <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📋</span>
          </div>
          <h3 className="text-lg font-semibold text-neutral-800 mb-1">Briefing required</h3>
          <p className="text-sm text-neutral-500 mb-6 max-w-md mx-auto">
            Generate a briefing before capturing this conversation. The briefing structures what to look for.
          </p>
          <button
            onClick={() => router.push(`/deals/${dealId}/dashboard`)}
            className="px-6 py-3 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 transition-all"
          >
            → Go to dashboard
          </button>
        </div>
      )}

      {/* Instruction */}
      {isLatestRound && hasBriefing && (
        <div className="bg-violet-50 border border-violet-200 rounded-2xl px-5 py-4 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-violet-400" />
            <span className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Log conversation</span>
          </div>
          <p className="text-sm text-violet-700">
            Type what was actually said, in the prospect's words. Skip what didn't come up. Don't reframe — log it raw.
          </p>
        </div>
      )}

      {/* Questions from briefing */}
      {questions.length > 0 ? (
        <div className="space-y-5 mb-8">
          {/* Pressing */}
          {questions.filter(q => q.priority !== 'opportunistic').map((q, i) => {
            const key = q.variable || String(i)
            const val = notes[key] ?? ''
            return (
              <div key={`p-${i}`} className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
                <div className="bg-neutral-50 px-5 py-3 border-b border-neutral-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-neutral-800" />
                    <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">L{q.layer} · {q.variable} · pressing</span>
                  </div>
                  {q.intent && <p className="text-xs text-amber-700 italic bg-amber-50 px-2.5 py-1 rounded-lg inline-block mt-1">→ {q.intent}</p>}
                  <p className="text-sm text-neutral-800 font-medium mt-2">"{q.text}"</p>
                  {(q.sub_questions ?? []).length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 pl-3">
                      {q.sub_questions.map((sq, si) => (
                        <li key={si} className="text-xs text-neutral-500 flex items-start gap-1.5"><span className="text-neutral-300">↳</span>{sq}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="px-5 py-4">
                  {isLatestRound ? (
                    <textarea
                      value={val}
                      onChange={e => setNote(key, e.target.value)}
                      placeholder="What did they say? Skip if it didn't come up."
                      rows={3}
                      className={inputClass}
                    />
                  ) : (
                    <div className="bg-neutral-50 rounded-xl p-3 text-sm text-neutral-700 whitespace-pre-wrap min-h-[3rem]">
                      {val || <span className="text-neutral-300">Nothing captured</span>}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Opportunistic */}
          {questions.filter(q => q.priority === 'opportunistic').length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-2">
                <span className="w-2 h-2 rounded-full border-2 border-neutral-300" />
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Opportunistic — capture if it came up</span>
              </div>
              {questions.filter(q => q.priority === 'opportunistic').map((q, i) => {
                const key = q.variable || `opp-${i}`
                const val = notes[key] ?? ''
                return (
                  <div key={`opp-${i}`} className="bg-white rounded-2xl border border-dashed border-neutral-200 overflow-hidden">
                    <div className="bg-neutral-50/50 px-5 py-3 border-b border-neutral-100">
                      <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">L{q.layer} · {q.variable}</span>
                      {q.intent && <p className="text-xs text-amber-600 italic mt-1">→ {q.intent}</p>}
                      <p className="text-sm text-neutral-600 mt-2">"{q.text}"</p>
                      {(q.sub_questions ?? []).length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 pl-3">
                          {q.sub_questions.map((sq, si) => (
                            <li key={si} className="text-xs text-neutral-400 flex items-start gap-1.5"><span className="text-neutral-300">↳</span>{sq}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="px-5 py-4">
                      {isLatestRound ? (
                        <textarea
                          value={val}
                          onChange={e => setNote(key, e.target.value)}
                          placeholder="Only if it came up naturally."
                          rows={2}
                          className={inputClass}
                        />
                      ) : (
                        <div className="bg-neutral-50 rounded-xl p-3 text-sm text-neutral-600 whitespace-pre-wrap min-h-[2.5rem]">
                          {val || <span className="text-neutral-300">Nothing captured</span>}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      ) : (
        <div className="mb-8 bg-white rounded-2xl border border-dashed border-neutral-200 p-8 text-center">
          <p className="text-sm text-neutral-400 font-medium">No briefing questions yet</p>
          <p className="text-xs text-neutral-400 mt-1">
            Add field questions in the{' '}
            <button onClick={() => router.push(`/deals/${dealId}/briefing`)} className="text-blue-500 hover:text-blue-600 underline">
              briefing tab
            </button>{' '}
            first.
          </p>
        </div>
      )}

      {/* Free-form note */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5 mb-8 shadow-sm">
        <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Other signals</div>
        {isLatestRound ? (
          <textarea
            value={freeNote}
            onChange={e => setFreeNote(e.target.value)}
            placeholder="Tone shifts, unexpected topics, off-script moments, body language reads…"
            rows={4}
            className={inputClass}
          />
        ) : (
          freeNote && (
            <div className="bg-neutral-50 rounded-xl p-3 text-sm text-neutral-700 whitespace-pre-wrap">
              {freeNote}
            </div>
          )
        )}
      </div>

      {/* Save + next action */}
      {isLatestRound && hasBriefing && (
        <div className="flex items-center gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={saving || suggestingScores}
            className="px-6 py-3 bg-white text-neutral-700 text-sm font-medium rounded-xl border border-neutral-200 hover:border-neutral-400 hover:shadow-sm disabled:opacity-40 transition-all"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={handleAnalyze}
            disabled={suggestingScores || saving}
            className="px-6 py-3 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 disabled:opacity-40 transition-all"
          >
            {suggestingScores ? 'Analyzing…' : '✦ Analyze → Dashboard'}
          </button>
          {error && <span className="text-sm text-rose-600">{error}</span>}
        </div>
      )}
    </div>
  )
}
