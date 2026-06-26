'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  type Deal, type DealRound,
  LAYER_VARIABLES, LAYER_LABELS, VARIABLE_LABELS,
  getLayerVerdict,
} from '@/lib/types'
import RoundTimeline from '@/components/deal/RoundTimeline'

// ── Score bar display ────────────────────────────────────────

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return <span className="font-mono text-sm text-stone-400">— · · · · ·</span>
  const blocks = [1, 2, 3, 4, 5].map(i => i <= score ? '█' : '░').join('')
  return <span className="font-mono text-sm text-stone-800">{blocks} <span className="text-stone-500">{score}/5</span></span>
}

// ── Clickable score selector (1–5 dots) ──────────────────────

function ScorePicker({
  value,
  onChange,
  disabled,
}: {
  value: number | null
  onChange: (v: number | null) => void
  disabled: boolean
}) {
  return (
    <div className="flex gap-1 mt-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          disabled={disabled}
          onClick={() => onChange(value === i ? null : i)}
          title={`Score ${i}`}
          className={`w-6 h-6 border text-xs font-mono transition-colors ${
            value !== null && i <= value
              ? i <= 2
                ? 'bg-rose-700 border-rose-700 text-white'
                : i === 3
                  ? 'bg-amber-600 border-amber-600 text-white'
                  : 'bg-emerald-700 border-emerald-700 text-white'
              : 'border-stone-300 text-stone-400 hover:border-stone-600 hover:text-stone-700'
          } disabled:opacity-40`}
        >
          {i}
        </button>
      ))}
      {value !== null && (
        <button
          disabled={disabled}
          onClick={() => onChange(null)}
          className="ml-1 text-[10px] font-mono text-stone-400 hover:text-stone-700 disabled:opacity-40"
          title="Clear"
        >
          ×
        </button>
      )}
    </div>
  )
}

// ── Layer card ───────────────────────────────────────────────

const LAYER_QUESTIONS: Record<number, string> = {
  1: 'Stay or disengage?',
  2: 'Are we positioned to win?',
  3: 'Can we create meaningful outcomes?',
  4: 'Will a decision happen?',
}

function LayerCard({
  layer,
  round,
  isEditing,
  pending,
  onScore,
}: {
  layer: number
  round: DealRound | null
  isEditing: boolean
  pending: Partial<DealRound>
  onScore: (field: string, value: number | null) => void
}) {
  const vars = LAYER_VARIABLES[layer as keyof typeof LAYER_VARIABLES]
  const verdict = getLayerVerdict(round ? { ...round, ...pending } as DealRound : null, layer)

  const verdictColor = verdict === 'PASS'
    ? 'text-emerald-800'
    : verdict === 'AT RISK'
      ? 'text-rose-800'
      : verdict === 'EMPTY'
        ? 'text-stone-400'
        : 'text-amber-800'

  return (
    <div className={`bg-stone-50 border p-5 ${layer === 1 ? 'border-l-4 border-l-orange-700 border-stone-300' : 'border-stone-300'}`}>
      <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-stone-300">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500 font-mono">Layer {layer}</div>
          <h3 className="font-serif text-lg text-stone-900 italic mt-1">
            {LAYER_LABELS[layer]} — {LAYER_QUESTIONS[layer]}
          </h3>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">verdict</div>
          <div className={`font-mono text-sm mt-1 ${verdictColor}`}>{verdict}</div>
          {layer === 1 && <div className="text-[10px] uppercase tracking-widest text-orange-700 font-mono mt-1">· active ·</div>}
        </div>
      </div>

      <div className="space-y-4">
        {vars.map(v => {
          const field = v as keyof DealRound
          const currentValue = (pending[field] !== undefined ? pending[field] : round?.[field]) as number | null
          return (
            <div key={v}>
              <div className="text-xs text-stone-700 font-medium">{VARIABLE_LABELS[v]}</div>
              {isEditing ? (
                <ScorePicker
                  value={currentValue}
                  onChange={val => onScore(v, val)}
                  disabled={false}
                />
              ) : (
                <ScoreBar score={currentValue} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────

export default function DealDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const dealId = params.id as string

  const [deal, setDeal] = useState<Deal | null>(null)
  const [rounds, setRounds] = useState<DealRound[]>([])
  const [selectedRound, setSelectedRound] = useState<number>(0)
  const [isEditing, setIsEditing] = useState(false)
  const [pending, setPending] = useState<Partial<DealRound>>({})
  const [saving, setSaving] = useState(false)
  const [addingRound, setAddingRound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatingNarrative, setGeneratingNarrative] = useState(false)
  const [generatingBriefing, setGeneratingBriefing] = useState(false)

  const currentRoundData = rounds.find(r => r.round === selectedRound) ?? null

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
      if (latest) setSelectedRound(latest.round)
    }
  }, [dealId])

  useEffect(() => { load() }, [load])

  function handleScore(field: string, value: number | null) {
    setPending(p => ({ ...p, [field]: value }))
  }

  async function handleSave() {
    if (!currentRoundData) return
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('deal_rounds')
      .update(pending)
      .eq('id', currentRoundData.id)
    if (error) { setError(error.message); setSaving(false); return }
    await load()
    setPending({})
    setIsEditing(false)
    setSaving(false)
  }

  function handleCancelEdit() {
    setPending({})
    setIsEditing(false)
  }

  async function handleGenerateFirstBriefing() {
    if (!currentRoundData) return
    setGeneratingBriefing(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, roundId: currentRoundData.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'AI error')
      router.push(`/deals/${dealId}/briefing`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate briefing')
      setGeneratingBriefing(false)
    }
  }

  async function handleGenerateNarrative() {
    if (!currentRoundData) return
    setGeneratingNarrative(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, roundId: currentRoundData.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'AI error')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate narrative')
    }
    setGeneratingNarrative(false)
  }

  async function handleAddRound() {
    if (!deal) return
    setAddingRound(true)
    setError(null)
    const supabase = createClient()
    const nextRound = deal.current_round + 1
    const { error: insertErr } = await supabase
      .from('deal_rounds')
      .insert({ deal_id: dealId, round: nextRound })
    if (insertErr) { setError(insertErr.message); setAddingRound(false); return }
    await supabase.from('deals').update({ current_round: nextRound }).eq('id', dealId)
    await load()
    setSelectedRound(nextRound)
    setAddingRound(false)
  }

  if (!deal) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-6">
        <div className="text-xs font-mono text-stone-400">Loading…</div>
      </div>
    )
  }

  const nodes = rounds.map(r => ({
    round: r.round,
    created_at: r.created_at,
    roundData: r,
  }))

  const isLatestRound = selectedRound === deal.current_round
  const hasPending = Object.keys(pending).length > 0

  const allVars = Object.values(LAYER_VARIABLES).flat() as string[]
  const hasAnyScore = currentRoundData !== null && allVars.some(v => currentRoundData[v as keyof typeof currentRoundData] !== null)

  return (
    <div className="max-w-5xl mx-auto py-8 px-6">
      {/* Header */}
      <div className="flex items-baseline justify-between pb-4 mb-6 border-b border-stone-300">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500 font-mono">
            <button onClick={() => router.push('/pipeline')} className="hover:text-stone-900 mr-2">← pipeline</button>
            {deal.prospect_name}
          </div>
          <h2 className="font-serif text-xl text-stone-900 italic mt-1">
            {deal.contact_name ?? 'Deal dashboard'}
          </h2>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">round</div>
          <div className="font-mono text-2xl text-stone-900">
            {selectedRound === 0 ? '0 · initial' : selectedRound}
          </div>
        </div>
      </div>

      {/* Round timeline */}
      <RoundTimeline
        nodes={nodes}
        currentRound={selectedRound}
        onSelect={r => { setSelectedRound(r); setPending({}); setIsEditing(false) }}
        onAddRound={isLatestRound && !isEditing ? handleAddRound : undefined}
        addingRound={addingRound}
      />

      {/* Edit toolbar */}
      {isLatestRound && (
        <div className="flex items-center gap-3 mb-6">
          {!isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 border border-stone-900 text-stone-900 text-xs uppercase tracking-widest font-mono hover:bg-stone-900 hover:text-stone-50"
              >
                edit scores
              </button>
              <button
                onClick={handleGenerateNarrative}
                disabled={generatingNarrative}
                className="px-4 py-2 border border-stone-500 text-stone-600 text-xs uppercase tracking-widest font-mono hover:bg-stone-100 disabled:opacity-40"
              >
                {generatingNarrative ? 'generating…' : '✦ narrative'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSave}
                disabled={saving || !hasPending}
                className="px-4 py-2 bg-stone-900 text-stone-50 text-xs uppercase tracking-widest font-mono hover:bg-stone-800 disabled:opacity-40"
              >
                {saving ? 'saving…' : 'save'}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="px-4 py-2 border border-stone-300 text-stone-600 text-xs uppercase tracking-widest font-mono hover:border-stone-600"
              >
                cancel
              </button>
            </>
          )}
          {error && <span className="text-xs font-mono text-rose-700">{error}</span>}
        </div>
      )}

      {/* Viewing older round notice */}
      {!isLatestRound && (
        <div className="mb-6 px-4 py-2 bg-stone-100 border border-stone-300 text-[11px] font-mono text-stone-500 uppercase tracking-widest">
          viewing historical round — scores are read-only
        </div>
      )}

      {/* First briefing CTA — shown when no scores exist yet */}
      {isLatestRound && !hasAnyScore && !isEditing && (
        <div className="mb-8 border-2 border-dashed border-stone-300 p-8 text-center">
          <div className="text-[10px] uppercase tracking-widest text-stone-500 font-mono mb-3">no scores yet</div>
          <p className="font-serif italic text-stone-700 text-base mb-1">
            Start by preparing your first briefing.
          </p>
          <p className="text-xs text-stone-500 font-mono mb-6">
            The engine will use your vendor profile and prospect context to generate it.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleGenerateFirstBriefing}
              disabled={generatingBriefing}
              className="px-6 py-3 bg-stone-900 text-stone-50 text-xs uppercase tracking-widest font-mono hover:bg-stone-800 disabled:opacity-40"
            >
              {generatingBriefing ? 'generating briefing…' : '✦ generate first briefing'}
            </button>
            <button
              onClick={() => router.push(`/deals/${dealId}/briefing`)}
              className="px-6 py-3 border border-stone-300 text-stone-600 text-xs uppercase tracking-widest font-mono hover:border-stone-900 hover:text-stone-900"
            >
              write it manually →
            </button>
          </div>
          {error && <p className="mt-4 text-xs font-mono text-rose-700">{error}</p>}
        </div>
      )}

      {/* Layer cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {[1, 2, 3, 4].map(layer => (
          <LayerCard
            key={layer}
            layer={layer}
            round={currentRoundData}
            isEditing={isEditing && isLatestRound}
            pending={pending}
            onScore={handleScore}
          />
        ))}
      </div>

      {/* Narrative placeholder */}
      {currentRoundData?.narrative && (
        <div className="mt-8 p-5 border border-stone-300 bg-stone-50">
          <div className="text-[10px] uppercase tracking-widest text-stone-500 font-mono mb-2">engine narrative</div>
          <p className="text-sm text-stone-700 leading-relaxed">{currentRoundData.narrative}</p>
        </div>
      )}
    </div>
  )
}
