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

  const currentRoundData = rounds.find(r => r.round === selectedRound) ?? null
  const isLatestRound = deal ? selectedRound === deal.current_round : false

  // Questions to capture against come from the briefing of the same round
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
    const found = rounds.find(rd => rd.round === r) ?? null
    populateFromRound(found)
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

  if (!deal) {
    return <div className="max-w-4xl mx-auto py-12 px-6 text-xs font-mono text-stone-400">Loading…</div>
  }

  const nodes = rounds.map(r => ({
    round: r.round,
    created_at: r.created_at,
    roundData: r,
  }))

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
            Conversation log · {selectedRound === 0 ? 'initial' : `round ${selectedRound}`}
          </h2>
        </div>
      </div>

      {/* Round timeline */}
      <RoundTimeline
        nodes={nodes}
        currentRound={selectedRound}
        onSelect={handleSelectRound}
      />

      {/* Historical notice */}
      {!isLatestRound && (
        <div className="mb-6 px-4 py-2 bg-stone-100 border border-stone-300 text-[11px] font-mono text-stone-500 uppercase tracking-widest">
          viewing historical capture — read only
        </div>
      )}

      {/* Instruction */}
      {isLatestRound && (
        <div className="border-l-2 border-stone-900 pl-4 py-2 mb-8 bg-stone-50">
          <div className="text-[10px] uppercase tracking-widest text-stone-500 font-mono mb-1">log conversation</div>
          <p className="text-sm text-stone-800 font-serif italic">
            Type what was actually said, in the prospect's words. Skip what didn't come up. Don't reframe — log it raw.
          </p>
        </div>
      )}

      {/* Questions from briefing */}
      {questions.length > 0 ? (
        <div className="space-y-6 mb-8">
          {questions.map((q, i) => {
            const key = q.variable || String(i)
            const val = notes[key] ?? ''
            return (
              <div key={i}>
                <div className="text-[10px] uppercase tracking-widest text-stone-400 font-mono mb-1">
                  L{q.layer} · {q.variable}
                </div>
                <p className="text-sm text-stone-900 font-serif italic mb-2">"{q.text}"</p>
                {isLatestRound ? (
                  <textarea
                    value={val}
                    onChange={e => setNote(key, e.target.value)}
                    placeholder="[didn't come up · skip]"
                    rows={3}
                    className="w-full border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 font-mono focus:outline-none focus:border-stone-900 resize-none placeholder:text-stone-300"
                  />
                ) : (
                  <div className="border border-stone-300 bg-white p-3 text-sm text-stone-800 font-mono whitespace-pre-wrap min-h-[3rem]">
                    {val || <span className="text-stone-400">[didn't come up · skip]</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="mb-8 px-4 py-6 border border-dashed border-stone-300 text-center">
          <p className="text-xs font-mono text-stone-400 uppercase tracking-widest">No briefing questions yet</p>
          <p className="text-xs text-stone-500 mt-1">
            Add field questions in the{' '}
            <button
              onClick={() => router.push(`/deals/${dealId}/briefing`)}
              className="underline hover:text-stone-900"
            >
              briefing tab
            </button>{' '}
            first.
          </p>
        </div>
      )}

      {/* Free-form note */}
      <div className="mb-8">
        <div className="text-[10px] uppercase tracking-widest text-stone-500 font-mono mb-2">other signals · anything else that came up</div>
        {isLatestRound ? (
          <textarea
            value={freeNote}
            onChange={e => setFreeNote(e.target.value)}
            placeholder="Tone shifts, unexpected topics, off-script moments, body language reads…"
            rows={4}
            className="w-full border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 font-mono focus:outline-none focus:border-stone-900 resize-none placeholder:text-stone-400"
          />
        ) : (
          freeNote && (
            <div className="border border-stone-300 bg-white p-3 text-sm text-stone-800 font-mono whitespace-pre-wrap">
              {freeNote}
            </div>
          )
        )}
      </div>

      {/* Save + next action */}
      {isLatestRound && (
        <div className="flex items-center gap-3 pt-2 border-t border-stone-300">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-stone-900 text-stone-50 px-6 py-3 text-sm uppercase tracking-widest font-mono hover:bg-stone-800 disabled:opacity-40"
          >
            {saving ? 'saving…' : 'save capture'}
          </button>
          <button
            onClick={() => router.push(`/deals/${dealId}/dashboard`)}
            className="px-6 py-3 border border-stone-300 text-stone-600 text-sm uppercase tracking-widest font-mono hover:border-stone-900 hover:text-stone-900"
          >
            → update scores
          </button>
          {error && <span className="text-xs font-mono text-rose-700">{error}</span>}
        </div>
      )}
    </div>
  )
}
