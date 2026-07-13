'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  type Deal, type DealRound, type EvidenceLevel, type SourceAuthority,
  LAYER_VARIABLES, LAYER_LABELS, VARIABLE_LABELS,
  EVIDENCE_CAP, EVIDENCE_LABELS, EVIDENCE_DESCRIPTIONS,
  AUTHORITY_LABELS,
  getLayerVerdict, getLayerAverage, capScore, weightedScore,
} from '@/lib/types'
import RoundTimeline from '@/components/deal/RoundTimeline'
import { useI18n } from '@/lib/i18n/context'

// ── Layer color system ──────────────────────────────────────

const LAYER_COLORS: Record<number, { accent: string; bg: string; border: string; badge: string }> = {
  1: { accent: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-500' },
  2: { accent: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-500' },
  3: { accent: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', badge: 'bg-violet-500' },
  4: { accent: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200', badge: 'bg-cyan-500' },
}

// ── Score bar display ────────────────────────────────────────

const EVIDENCE_PILL: Record<EvidenceLevel, string> = {
  declared: 'text-amber-700 bg-amber-100',
  corroborated: 'text-blue-700 bg-blue-100',
  verified: 'text-emerald-700 bg-emerald-100',
}

function VariableRow({ label, rationale, children }: { label: string; rationale?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm text-neutral-700 font-medium">{label}</div>
      {children}
      {rationale && (
        <p className="text-[11px] text-neutral-500 mt-1 pl-2 border-l-2 border-neutral-200 leading-relaxed italic">{rationale}</p>
      )}
    </div>
  )
}

const AUTHORITY_PILL: Record<SourceAuthority, string> = {
  decision_maker: 'text-purple-700 bg-purple-100',
  influencer: 'text-indigo-700 bg-indigo-100',
  end_user: 'text-neutral-600 bg-neutral-100',
}

function ScoreBar({ score, evidence, authority }: { score: number | null; evidence?: EvidenceLevel; authority?: SourceAuthority }) {
  if (score === null) return <div className="flex items-center gap-1.5 mt-1"><div className="h-2 flex-1 bg-neutral-100 rounded-full" /><span className="text-xs text-neutral-300 w-8">—</span></div>
  const ev = evidence ?? 'declared'
  const auth = authority ?? 'end_user'
  const effective = weightedScore(score, ev, auth)
  const pct = (effective / 5) * 100
  const barColor = effective <= 2 ? 'bg-rose-500' : effective <= 3 ? 'bg-amber-400' : 'bg-emerald-500'
  return (
    <div className="mt-1 space-y-1">
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 bg-neutral-100 rounded-full overflow-hidden relative">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-semibold text-neutral-700 w-8 text-right">{effective.toFixed(1)}/5</span>
      </div>
      <div className="flex gap-1.5">
        {evidence && (
          <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${EVIDENCE_PILL[evidence]}`}>
            {EVIDENCE_LABELS[evidence]}
          </span>
        )}
        {authority && authority !== 'end_user' && (
          <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${AUTHORITY_PILL[authority]}`}>
            {AUTHORITY_LABELS[authority]}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Clickable score selector ────────────────────────────────

function ScorePicker({
  value,
  evidence,
  onChange,
  onEvidenceChange,
  disabled,
}: {
  value: number | null
  evidence: EvidenceLevel
  onChange: (v: number | null) => void
  onEvidenceChange: (v: EvidenceLevel) => void
  disabled: boolean
}) {
  const cap = EVIDENCE_CAP[evidence]
  return (
    <div className="mt-1.5 space-y-2">
      <div className="flex gap-1.5 items-center">
        {[1, 2, 3, 4, 5].map(i => (
          <button
            key={i}
            disabled={disabled || i > cap}
            onClick={() => onChange(value === i ? null : i)}
            title={i > cap ? `Capped by ${evidence} evidence (max ${cap})` : `Score ${i}`}
            className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all ${
              i > cap
                ? 'bg-neutral-50 text-neutral-200 cursor-not-allowed border border-neutral-100'
                : value !== null && i <= value
                  ? i <= 2
                    ? 'bg-rose-500 text-white shadow-sm'
                    : i === 3
                      ? 'bg-amber-400 text-white shadow-sm'
                      : 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-white border border-neutral-200 text-neutral-400 hover:border-neutral-400 hover:text-neutral-700'
            } disabled:opacity-40`}
          >
            {i}
          </button>
        ))}
        {value !== null && (
          <button
            disabled={disabled}
            onClick={() => onChange(null)}
            className="ml-1 text-xs text-neutral-300 hover:text-neutral-600 disabled:opacity-40"
            title="Clear"
          >
            ✕
          </button>
        )}
      </div>
      <div className="flex gap-1.5">
        {(['declared', 'corroborated', 'verified'] as EvidenceLevel[]).map(ev => (
          <button
            key={ev}
            disabled={disabled}
            onClick={() => {
              onEvidenceChange(ev)
              if (value !== null && value > EVIDENCE_CAP[ev]) onChange(EVIDENCE_CAP[ev])
            }}
            title={EVIDENCE_DESCRIPTIONS[ev]}
            className={`text-[10px] font-medium px-2.5 py-1 rounded-full transition-all ${
              evidence === ev
                ? EVIDENCE_PILL[ev]
                : 'bg-neutral-50 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'
            } disabled:opacity-40`}
          >
            {EVIDENCE_LABELS[ev]} ≤{EVIDENCE_CAP[ev]}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Layer card ───────────────────────────────────────────────


function LayerCard({
  layer,
  round,
  isEditing,
  pending,
  pendingEvidence,
  onScore,
  onEvidence,
}: {
  layer: number
  round: DealRound | null
  isEditing: boolean
  pending: Partial<DealRound>
  pendingEvidence: Record<string, EvidenceLevel>
  onScore: (field: string, value: number | null) => void
  onEvidence: (field: string, value: EvidenceLevel) => void
}) {
  const { t } = useI18n()
  const vars = LAYER_VARIABLES[layer as keyof typeof LAYER_VARIABLES]
  const merged = round ? { ...round, ...pending } as DealRound : null
  const verdict = getLayerVerdict(merged, layer)
  const avg = getLayerAverage(merged, layer)
  const colors = LAYER_COLORS[layer]

  const verdictStyle = verdict === 'PASS'
    ? 'text-emerald-600 bg-emerald-50'
    : verdict === 'AT RISK'
      ? 'text-rose-600 bg-rose-50'
      : verdict === 'EMPTY'
        ? 'text-neutral-400 bg-neutral-50'
        : 'text-amber-600 bg-amber-50'

  return (
    <div className={`bg-white rounded-2xl border ${colors.border} overflow-hidden shadow-sm`}>
      <div className={`${colors.bg} px-5 py-4 flex items-center justify-between`}>
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${colors.badge}`} />
            <span className={`text-xs font-semibold tracking-wide uppercase ${colors.accent}`}>Layer {layer}</span>
          </div>
          <h3 className="text-base font-semibold text-neutral-800 mt-1">
            {t(`layer.${layer}` as any)} <span className="font-normal text-neutral-500">— {t(`layer.q${layer}` as any)}</span>
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {avg !== null && (
            <span className="text-sm font-bold text-neutral-700">{avg.toFixed(1)}<span className="text-neutral-400 font-normal">/5</span></span>
          )}
          <span className={`text-[11px] font-semibold px-3 py-1 rounded-full ${verdictStyle}`}>
            {verdict}
          </span>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {vars.map(v => {
          const field = v as keyof DealRound
          const currentValue = (pending[field] !== undefined ? pending[field] : round?.[field]) as number | null
          const evidenceLevels = round?.evidence_levels ?? {}
          const authorityLevels = (round?.authority_levels ?? {}) as Record<string, SourceAuthority>
          const currentEvidence: EvidenceLevel = pendingEvidence[v] ?? evidenceLevels[v] ?? 'declared'
          const currentAuthority: SourceAuthority = authorityLevels[v] ?? 'end_user'
          const rationale = (round?.rationales ?? {})[v] as string | undefined
          return (
            <VariableRow key={v} label={t(`var.${v}` as any)} rationale={rationale}>
              {isEditing ? (
                <ScorePicker
                  value={currentValue}
                  evidence={currentEvidence}
                  onChange={val => onScore(v, val)}
                  onEvidenceChange={val => onEvidence(v, val)}
                  disabled={false}
                />
              ) : (
                <ScoreBar score={currentValue} evidence={currentEvidence} authority={currentAuthority} />
              )}
            </VariableRow>
          )
        })}
      </div>
    </div>
  )
}

// ── Buttons ─────────────────────────────────────────────────

function PrimaryButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} className="px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 disabled:opacity-40 transition-all">
      {children}
    </button>
  )
}

function SecondaryButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} className="px-5 py-2.5 bg-white text-neutral-700 text-sm font-medium rounded-xl border border-neutral-200 hover:border-neutral-400 hover:shadow-sm disabled:opacity-40 transition-all">
      {children}
    </button>
  )
}

// ── Page ─────────────────────────────────────────────────────

export default function DealDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const { t, locale } = useI18n()
  const dealId = params.id as string

  const [deal, setDeal] = useState<Deal | null>(null)
  const [rounds, setRounds] = useState<DealRound[]>([])
  const [selectedRound, setSelectedRound] = useState<number>(0)
  const isEditing = false
  const [pending, setPending] = useState<Partial<DealRound>>({})
  const [pendingEvidence, setPendingEvidence] = useState<Record<string, EvidenceLevel>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
      // Default to the latest round that has a briefing; otherwise stay on Initial (R0).
      const latestBriefed = [...roundData].reverse().find(r => !!r.briefing_line)
      setSelectedRound(prev => prev > 0 ? prev : (latestBriefed?.round ?? 0))
    }
  }, [dealId])

  useEffect(() => { load() }, [load])

  function handleScore(field: string, value: number | null) {
    setPending(p => ({ ...p, [field]: value }))
  }

  function handleEvidence(field: string, value: EvidenceLevel) {
    setPendingEvidence(p => ({ ...p, [field]: value }))
  }

  async function handleSave() {
    if (!currentRoundData) return
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const mergedEvidence = { ...(currentRoundData.evidence_levels ?? {}), ...pendingEvidence }
    const { error } = await supabase
      .from('deal_rounds')
      .update({ ...pending, evidence_levels: mergedEvidence })
      .eq('id', currentRoundData.id)
    if (error) { setError(error.message); setSaving(false); return }
    await load()
    setPending({})
    setPendingEvidence({})
    setSaving(false)
  }

  async function handleGenerateBriefing(roundId: string, opts?: { stay?: boolean }) {
    setGeneratingBriefing(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, roundId, locale }),
      })
      const text = await res.text()
      let data: { error?: string; briefing?: unknown }
      try { data = JSON.parse(text) } catch { throw new Error(`[${res.status}] ${text.slice(0, 300)}`) }
      if (data.error) throw new Error(data.error)
      if (opts?.stay) {
        await load()
        setGeneratingBriefing(false)
      } else {
        router.push(`/deals/${dealId}/briefing`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate briefing')
      setGeneratingBriefing(false)
    }
  }

  async function handleStartNextRound() {
    if (!deal) return
    setGeneratingBriefing(true)
    setError(null)
    try {
      const supabase = createClient()
      const nextRound = deal.current_round + 1
      const prevRound = rounds.find(r => r.round === deal.current_round)
      const allVars = Object.values(LAYER_VARIABLES).flat() as string[]
      const inheritedScores: Record<string, unknown> = {}
      if (prevRound) {
        for (const v of allVars) {
          const score = prevRound[v as keyof DealRound] as number | null
          if (score !== null) inheritedScores[v] = score
        }
        const prevEvidence = (prevRound.evidence_levels ?? {}) as Record<string, string>
        if (Object.keys(prevEvidence).length > 0) inheritedScores.evidence_levels = prevEvidence
        const prevAuthority = ((prevRound as Record<string, unknown>).authority_levels ?? {}) as Record<string, string>
        if (Object.keys(prevAuthority).length > 0) inheritedScores.authority_levels = prevAuthority
        const prevRationales = (prevRound.rationales ?? {}) as Record<string, string>
        if (Object.keys(prevRationales).length > 0) inheritedScores.rationales = prevRationales
      }

      const { data: newRound, error: insertErr } = await supabase
        .from('deal_rounds')
        .insert({ deal_id: dealId, round: nextRound, ...inheritedScores })
        .select()
        .single()
      if (insertErr || !newRound) throw new Error(insertErr?.message ?? 'Could not create round')
      await supabase.from('deals').update({ current_round: nextRound }).eq('id', dealId)
      await load()
      setSelectedRound(nextRound)
      await handleGenerateBriefing(newRound.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start next round')
      setGeneratingBriefing(false)
    }
  }


  if (!deal) {
    return (
      <div className="max-w-5xl mx-auto py-8 sm:py-12 px-4 sm:px-6">
        <div className="text-sm text-neutral-400">Loading…</div>
      </div>
    )
  }

  const nodes = [
    { round: 0, created_at: deal.created_at, roundData: null },
    ...rounds.map(r => ({
      round: r.round,
      created_at: r.created_at,
      roundData: r,
    })),
  ]

  const isLatestRound = selectedRound === deal.current_round
  const hasPending = Object.keys(pending).length > 0 || Object.keys(pendingEvidence).length > 0
  const allVars = Object.values(LAYER_VARIABLES).flat() as string[]
  const hasAnyScore = currentRoundData !== null && allVars.some(v => currentRoundData[v as keyof typeof currentRoundData] !== null)
  const hasBriefing = !!(currentRoundData?.briefing_line)
  const hasCapture = currentRoundData !== null && (() => {
    const notes = currentRoundData.capture_notes as Record<string, string> | null
    return notes && Object.keys(notes).some(k => k !== '__free__' && notes[k]?.trim())
  })()
  const roundState = !hasBriefing ? 'UNSTARTED' : !hasCapture ? 'BRIEFED' : 'SCORED'

  return (
    <div className="max-w-5xl mx-auto py-6 sm:py-8 px-4 sm:px-6">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <button onClick={() => router.push('/pipeline')} className="text-sm text-neutral-400 hover:text-blue-500 transition-colors mb-1 block">
            {t('dashboard.backToPipeline')}
          </button>
          <h1 className="text-2xl font-bold text-neutral-900">{deal.prospect_name}</h1>
          <div className="flex items-center gap-3 mt-0.5">
            {deal.contact_name && <span className="text-sm text-neutral-500">{deal.contact_name}{deal.contact_title ? ` · ${deal.contact_title}` : ''}</span>}
            <span className="text-sm font-semibold text-blue-600">
              {deal.potential_revenue ? `${deal.potential_revenue >= 1000 ? `${(deal.potential_revenue / 1000).toFixed(deal.potential_revenue % 1000 === 0 ? 0 : 1)}k€` : `${deal.potential_revenue}€`}` : ''}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-medium text-neutral-400 uppercase tracking-wide">{t('dashboard.round')}</div>
          <div className="text-3xl font-bold text-neutral-900 leading-none">
            {selectedRound}
          </div>
        </div>
      </div>

      {/* Round timeline */}
      <RoundTimeline
        nodes={nodes}
        currentRound={selectedRound}
        onSelect={r => { setSelectedRound(r); setPending({}); setPendingEvidence({}) }}
      />

      {/* Historical notice — hide on Initial (R0) since it's not historical */}
      {!isLatestRound && selectedRound !== 0 && (
        <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 font-medium">
          {locale === 'fr' ? 'Round historique — lecture seule' : 'Viewing historical round — scores are read-only'}
        </div>
      )}

      {/* ── Initial (R0) view — welcome + CTA to brief round 1 ── */}
      {selectedRound === 0 && (
        <div className="mb-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-8 shadow-sm">
          <h3 className="text-lg font-semibold text-neutral-800 mb-2">{t('dashboard.welcomeTitle')}</h3>
          <p className="text-sm text-neutral-600 mb-4">{t('dashboard.welcomeDesc')}</p>
          <ul className="space-y-2 mb-6">
            <li className="flex items-start gap-2 text-sm text-neutral-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
              {t('dashboard.welcomePoint1')}
            </li>
            <li className="flex items-start gap-2 text-sm text-neutral-600">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
              {t('dashboard.welcomePoint2')}
            </li>
            <li className="flex items-start gap-2 text-sm text-neutral-600">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 mt-1.5 flex-shrink-0" />
              {t('dashboard.welcomePoint3')}
            </li>
          </ul>
          <PrimaryButton
            onClick={handleStartNextRound}
            disabled={generatingBriefing}
          >
            {generatingBriefing ? t('dashboard.generating') : (locale === 'fr' ? `✦ Créer le briefing du round ${deal.current_round + 1}` : `✦ Create round ${deal.current_round + 1} briefing`)}
          </PrimaryButton>
          {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
        </div>
      )}

      {/* ── The Read — deal situation (rounds ≥ 1) ── */}
      {selectedRound !== 0 && currentRoundData?.briefing_read && (
        <div className="mb-6 bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-1 h-6 rounded-full bg-neutral-400" />
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{t('briefing.theRead')}</span>
            </div>
            {isLatestRound && (
              <button
                onClick={() => currentRoundData && handleGenerateBriefing(currentRoundData.id, { stay: true })}
                disabled={generatingBriefing}
                className="text-xs font-medium text-blue-500 hover:text-blue-600 disabled:opacity-40 transition-colors"
                title={locale === 'fr' ? 'Régénérer la lecture avec les scores actuels' : 'Regenerate the read with current scores'}
              >
                {generatingBriefing ? (locale === 'fr' ? 'Régénération…' : 'Regenerating…') : (locale === 'fr' ? '↻ Régénérer' : '↻ Regenerate')}
              </button>
            )}
          </div>
          <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">{currentRoundData.briefing_read}</p>
        </div>
      )}

      {/* ── State machine for latest round ── */}
      {selectedRound !== 0 && isLatestRound && roundState === 'UNSTARTED' && (
        <div className="mb-8 bg-white rounded-2xl border-2 border-dashed border-neutral-200 p-10 text-center">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✦</span>
          </div>
          <h3 className="text-lg font-semibold text-neutral-800 mb-1">
            {locale === 'fr' ? 'Préparez votre briefing' : 'Prepare your briefing'}
          </h3>
          <p className="text-sm text-neutral-500 mb-6 max-w-md mx-auto">
            {locale === 'fr' ? 'Le moteur analysera votre profil vendeur et le contexte prospect pour générer un plan de conversation.' : 'The engine will analyze your vendor profile and prospect context to generate a conversation plan.'}
          </p>
          <PrimaryButton
            onClick={() => currentRoundData && handleGenerateBriefing(currentRoundData.id)}
            disabled={generatingBriefing || !currentRoundData}
          >
            {generatingBriefing ? t('dashboard.generating') : locale === 'fr' ? '✦ Générer le briefing' : '✦ Generate briefing'}
          </PrimaryButton>
          {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
        </div>
      )}

      {isLatestRound && roundState === 'BRIEFED' && (
        <div className="mb-6 bg-white rounded-2xl border border-neutral-200 px-6 py-5 flex items-center justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">{locale === 'fr' ? 'Briefing prêt' : 'Briefing ready'}</span>
            </div>
            <p className="text-sm text-neutral-600">
              {locale === 'fr' ? 'Allez en conversation, puis capturez les réponses.' : 'Go into the conversation, then capture the responses.'}
            </p>
          </div>
          <div className="flex gap-3 flex-shrink-0 ml-6">
            <SecondaryButton onClick={() => router.push(`/deals/${dealId}/briefing`)}>
              → Briefing
            </SecondaryButton>
            <PrimaryButton onClick={() => router.push(`/deals/${dealId}/capture`)}>
              → Capture
            </PrimaryButton>
          </div>
        </div>
      )}

      {isLatestRound && roundState === 'SCORED' && (
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1" />
          <PrimaryButton onClick={handleStartNextRound} disabled={generatingBriefing}>
            {generatingBriefing ? t('dashboard.generating') : locale === 'fr' ? `✦ Créer le briefing du round ${deal.current_round + 1} →` : `✦ Create round ${deal.current_round + 1} briefing →`}
          </PrimaryButton>
          {error && <span className="text-sm text-rose-600">{error}</span>}
        </div>
      )}

      {/* Layer cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {[1, 2, 3, 4].map(layer => (
          <LayerCard
            key={layer}
            layer={layer}
            round={currentRoundData}
            isEditing={false}
            pending={pending}
            pendingEvidence={pendingEvidence}
            onScore={handleScore}
            onEvidence={handleEvidence}
          />
        ))}
      </div>

    </div>
  )
}
