'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  type Deal, type DealRound, type EvidenceLevel, type SourceAuthority,
  LAYER_VARIABLES,
  EVIDENCE_CAP, EVIDENCE_DESCRIPTIONS,
} from '@/lib/types'
import {
  criterionScore, computeDealState, DECISIVE_VARS,
  type GateInfo, type MomentumInfo,
} from '@/lib/scoring'
import { evidenceFromDeclarations, type Declaration } from '@/lib/voice-credit'
import RoundTimeline from '@/components/deal/RoundTimeline'
import AIProgress from '@/components/ui/AIProgress'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/lib/i18n/context'

// Map raw API/AI errors to a human message; keep the technical detail separate.
function humanizeError(raw: string, t: (k: never) => string): { message: string; detail?: string } {
  const lower = raw.toLowerCase()
  if (lower.includes('credit balance') || lower.includes('rate limit') || lower.includes('overloaded') || lower.includes('timeout') || lower.includes('timed out') || raw.includes('"type":"error"') || lower.includes('invalid_request_error')) {
    return { message: t('common.aiUnavailable' as never), detail: raw }
  }
  return { message: raw }
}

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

const ROLE_LABEL: Record<string, string> = {
  decideur: 'Décideur', champion: 'Champion', acheteur_technique: 'Décideur technique',
  gardien_du_budget: 'Gardien du budget', utilisateur: 'Utilisateur', bloqueur: 'Bloqueur', unknown: 'Rôle inconnu',
}

function ScoreBar({ variable, score, evidence, authority, declarations }: { variable: string; score: number | null | undefined; evidence?: EvidenceLevel; authority?: SourceAuthority; declarations?: Declaration[] }) {
  const { t } = useI18n()
  if (score == null) return <div className="flex items-center gap-1.5 mt-1"><div className="h-2 flex-1 bg-neutral-100 rounded-full" /><span className="text-xs text-neutral-300 w-8">—</span></div>
  const effective = criterionScore(variable, score, evidence, authority) ?? 0
  const pct = (effective / 5) * 100
  const barColor = effective <= 2 ? 'bg-rose-500' : effective <= 3 ? 'bg-amber-400' : 'bg-emerald-500'
  // Voices behind the evidence badge (§4): shown on hover.
  const voiceTitle = declarations && declarations.length > 0
    ? declarations.map(d => `${d.contact ?? '?'} · ${ROLE_LABEL[d.role] ?? d.role}${d.stance === 'contre' ? ' (contre)' : ''}${d.quantified ? ' · chiffré' : ''}: ${d.text}`).join('\n')
    : undefined
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
          <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${EVIDENCE_PILL[evidence]} ${voiceTitle ? 'cursor-help' : ''}`} title={voiceTitle}>
            {t(`evidence.${evidence}` as never)}
            {declarations && declarations.length > 0 && <span className="ml-1 opacity-60">· {declarations.length}</span>}
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
  const { t } = useI18n()
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
              if (value !== null && value > EVIDENCE_CAP[ev]) onChange(Math.floor(EVIDENCE_CAP[ev]))
            }}
            title={EVIDENCE_DESCRIPTIONS[ev]}
            className={`text-[10px] font-medium px-2.5 py-1 rounded-full transition-all ${
              evidence === ev
                ? EVIDENCE_PILL[ev]
                : 'bg-neutral-50 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'
            } disabled:opacity-40`}
          >
            {t(`evidence.${ev}` as never)} ≤{EVIDENCE_CAP[ev]}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Layer card ───────────────────────────────────────────────


const STATUS_STYLE: Record<string, string> = {
  FRANCHIE: 'text-emerald-600 bg-emerald-50',
  VIVANT: 'text-emerald-600 bg-emerald-50',
  A_RISQUE: 'text-rose-600 bg-rose-50',
  EN_PANNE: 'text-rose-600 bg-rose-50',
  EMPTY: 'text-neutral-400 bg-neutral-50',
  EN_OBSERVATION: 'text-neutral-500 bg-neutral-100',
  EN_CONSTRUCTION: 'text-amber-600 bg-amber-50',
  FRAGILE: 'text-amber-600 bg-amber-50',
  PRETE: 'text-blue-600 bg-blue-50',
}

function LayerCard({
  layer,
  round,
  isEditing,
  pending,
  pendingEvidence,
  onScore,
  onEvidence,
  gate,
  momentum,
}: {
  layer: number
  round: DealRound | null
  isEditing: boolean
  pending: Partial<DealRound>
  pendingEvidence: Record<string, EvidenceLevel>
  onScore: (field: string, value: number | null) => void
  onEvidence: (field: string, value: EvidenceLevel) => void
  gate: GateInfo | null
  momentum: MomentumInfo | null
}) {
  const { t, locale } = useI18n()
  const vars = LAYER_VARIABLES[layer as keyof typeof LAYER_VARIABLES]
  const colors = LAYER_COLORS[layer]
  const isMomentum = layer === 4

  // Voice-credit alarms across this card's criteria (advocate voicing doubt).
  const allDeclarations = (round?.declarations ?? {}) as Record<string, Declaration[]>
  const cardAlarms = vars.flatMap(v => evidenceFromDeclarations(v, allDeclarations[v]).alarms)

  const score = isMomentum ? momentum?.score ?? null : gate?.score ?? null
  const status = round === null ? 'EMPTY' : isMomentum ? (momentum?.status ?? 'EN_OBSERVATION') : (gate?.status ?? 'EMPTY')
  const statusLabel = status === 'PRETE' && gate?.waitingForGate
    ? t('gate.waiting' as never).replace('{n}', String(gate.waitingForGate))
    : t(`verdict.${status}` as never)

  return (
    <div className={`bg-white rounded-2xl border ${colors.border} overflow-hidden shadow-sm`}>
      <div className={`${colors.bg} px-5 py-4 flex items-center justify-between gap-3`}>
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${colors.badge}`} />
            <span className={`text-xs font-semibold tracking-wide uppercase ${colors.accent}`}>
              {isMomentum ? t('gate.momentumLabel' as never) : `${t('gate.label' as never)} ${layer}`}
            </span>
          </div>
          <h3 className="text-base font-semibold text-neutral-800 mt-1">
            {isMomentum
              ? <span className="font-normal text-neutral-500">{t(`layer.q${layer}` as any)}</span>
              : <>{t(`layer.${layer}` as any)} <span className="font-normal text-neutral-500">— {t(`layer.q${layer}` as any)}</span></>}
          </h3>
          {layer === 1 && (
            <p className="text-[11px] text-neutral-500 mt-0.5">{t('gate.p1Subtitle' as never)}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {score !== null && (
            <span className="text-sm font-bold text-neutral-700">
              {score.toFixed(1)}<span className="text-neutral-400 font-normal">/5</span>
              {isMomentum && momentum?.trend && <span className="ml-1 text-base">{momentum.trend}</span>}
            </span>
          )}
          <span className={`text-[11px] font-semibold px-3 py-1 rounded-full whitespace-nowrap ${STATUS_STYLE[status] ?? 'text-neutral-400 bg-neutral-50'}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Gate lock / bonus / momentum alerts */}
      {!isMomentum && gate?.lockMessage && status !== 'EMPTY' && (
        <div className="px-5 py-2 bg-rose-50 border-b border-rose-100 text-xs font-medium text-rose-600">
          {t('gate.blocked' as never).replace('{var}', t(`var.${gate.lockMessage}` as any))}
        </div>
      )}
      {layer === 2 && gate?.urgencyProven && (
        <div className="px-5 py-2 bg-emerald-50 border-b border-emerald-100 text-xs font-medium text-emerald-600">
          ✓ {t('gate.urgencyProven' as never)}
        </div>
      )}
      {isMomentum && momentum?.stagnant && (
        <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 text-xs font-medium text-amber-700">
          {t('gate.momentumStagnant' as never)}
        </div>
      )}
      {cardAlarms.map((a, i) => (
        <div key={i} className="px-5 py-2 bg-rose-50 border-b border-rose-100 text-xs font-medium text-rose-600">
          ⚠ {a}
        </div>
      ))}

      <div className="px-5 py-4 space-y-4">
        {vars.map(v => {
          const field = v as keyof DealRound
          const currentValue = (pending[field] !== undefined ? pending[field] : round?.[field]) as number | null
          const evidenceLevels = round?.evidence_levels ?? {}
          const authorityLevels = (round?.authority_levels ?? {}) as Record<string, SourceAuthority>
          const currentEvidence: EvidenceLevel = pendingEvidence[v] ?? evidenceLevels[v] ?? 'declared'
          const currentAuthority: SourceAuthority = authorityLevels[v] ?? 'end_user'
          const rationale = (round?.rationales ?? {})[v] as string | undefined
          const label = DECISIVE_VARS[layer]?.includes(v) ? `⚡ ${t(`var.${v}` as any)}` : t(`var.${v}` as any)
          const hasEvidence = currentValue !== null && evidenceLevels[v] !== undefined
          return (
            <VariableRow key={v} label={label} rationale={rationale}>
              {isEditing ? (
                <ScorePicker
                  value={currentValue}
                  evidence={currentEvidence}
                  onChange={val => onScore(v, val)}
                  onEvidenceChange={val => onEvidence(v, val)}
                  disabled={false}
                />
              ) : (
                <ScoreBar variable={v} score={currentValue} evidence={hasEvidence || currentValue !== null ? currentEvidence : undefined} authority={currentAuthority} declarations={allDeclarations[v]} />
              )}
            </VariableRow>
          )
        })}
        {isMomentum && (
          <p className="text-[11px] text-neutral-400 pt-1 border-t border-neutral-100">
            {locale === 'fr'
              ? 'Freins notés en santé inversée : 5 = exploré et traité · 0 = jamais exploré.'
              : 'Brakes scored in inverted health: 5 = explored & handled · 0 = never explored.'}
          </p>
        )}
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
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [generatingBriefing, setGeneratingBriefing] = useState(false)
  const { toast } = useToast()

  const currentRoundData = rounds.find(r => r.round === selectedRound) ?? null

  const briefingSteps = [
    t('ai.step.profile' as never),
    t('ai.step.context' as never),
    t('ai.step.scores' as never),
    t('ai.step.questions' as never),
    t('ai.step.finalize' as never),
  ]

  const errorBlock = error ? (
    <div className="mt-4 text-left max-w-md mx-auto">
      <p className="text-sm text-rose-600">{error}</p>
      {errorDetail && (
        <details className="mt-1">
          <summary className="text-xs text-neutral-400 cursor-pointer">{locale === 'fr' ? 'Détails techniques' : 'Technical details'}</summary>
          <p className="text-xs text-neutral-400 mt-1 break-all">{errorDetail}</p>
        </details>
      )}
    </div>
  ) : null

  const load = useCallback(async () => {
    const supabase = createClient()
    const [{ data: dealData }, { data: roundData }] = await Promise.all([
      supabase.from('deals').select('*').eq('id', dealId).single(),
      supabase.from('deal_rounds').select('*').eq('deal_id', dealId).order('round', { ascending: true }),
    ])
    if (dealData) setDeal(dealData)
    if (roundData) {
      setRounds(roundData)
      // A round only "exists" on the dashboard once its conversation has been
      // captured/scored. A merely-briefed round is still the Départ phase, so
      // default to the latest captured round — otherwise Initial (R0).
      const allVars = Object.values(LAYER_VARIABLES).flat() as string[]
      const isCaptured = (r: DealRound) => {
        const notes = (r.capture_notes ?? {}) as Record<string, string>
        const hasNotes = Object.keys(notes).some(k => k !== '__free__' && notes[k]?.trim()) || !!notes.__free__?.trim()
        const hasScore = allVars.some(v => (r[v as keyof DealRound] as number | null) !== null)
        return hasNotes || hasScore
      }
      const latestCaptured = [...roundData].reverse().find(isCaptured)
      setSelectedRound(prev => prev > 0 ? prev : (latestCaptured?.round ?? 0))
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
      // "stay" = regenerate just the situational read (fast); otherwise
      // generate the full pre-conversation briefing and go to it.
      const endpoint = opts?.stay ? '/api/ai/read' : '/api/ai/briefing'
      const res = await fetch(endpoint, {
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
        toast(locale === 'fr' ? 'Lecture régénérée' : 'Read regenerated')
      } else {
        router.push(`/deals/${dealId}/briefing`)
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Failed to generate briefing'
      const { message, detail } = humanizeError(raw, t as (k: never) => string)
      setError(message)
      setErrorDetail(detail ?? null)
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
  const dealState = computeDealState(rounds, selectedRound)

  // On the Départ view: is round 1 already briefed but not yet captured?
  // (When it IS captured, load() defaults away from R0.)
  const inProgressRound = rounds.find(r => r.round === deal.current_round) ?? null
  const round1Briefed = deal.current_round >= 1 && !!inProgressRound?.briefing_line

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
          {!generatingBriefing && round1Briefed && (
            <div className="bg-white rounded-xl border border-emerald-200 px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">{locale === 'fr' ? `Briefing du round ${deal.current_round} prêt` : `Round ${deal.current_round} briefing ready`}</span>
              </div>
              <p className="text-sm text-neutral-600 mb-3">
                {locale === 'fr' ? 'Menez la conversation, puis capturez les réponses pour clôturer le round.' : 'Run the conversation, then capture the answers to close the round.'}
              </p>
              <div className="flex gap-3">
                <SecondaryButton onClick={() => router.push(`/deals/${dealId}/briefing`)}>→ Briefing</SecondaryButton>
                <PrimaryButton onClick={() => router.push(`/deals/${dealId}/capture`)}>→ {t('nav.capture')}</PrimaryButton>
              </div>
            </div>
          )}
          {!generatingBriefing && !round1Briefed && (
            <PrimaryButton onClick={handleStartNextRound} disabled={generatingBriefing}>
              {locale === 'fr' ? `✦ Créer le briefing du round ${deal.current_round + 1}` : `✦ Create round ${deal.current_round + 1} briefing`}
            </PrimaryButton>
          )}
          {generatingBriefing && <AIProgress steps={briefingSteps} />}
          {errorBlock}
        </div>
      )}

      {/* ── The Read — only once the round is captured (post-conversation read) ── */}
      {selectedRound !== 0 && currentRoundData?.briefing_read && hasCapture && (
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
            {generatingBriefing
              ? (locale === 'fr' ? 'Préparation de votre briefing' : 'Preparing your briefing')
              : (locale === 'fr' ? 'Préparez votre briefing' : 'Prepare your briefing')}
          </h3>
          <p className="text-sm text-neutral-500 mb-6 max-w-md mx-auto">
            {locale === 'fr' ? 'Le moteur analysera votre profil vendeur et le contexte prospect pour générer un plan de conversation.' : 'The engine will analyze your vendor profile and prospect context to generate a conversation plan.'}
          </p>
          {!generatingBriefing && (
            <PrimaryButton
              onClick={() => currentRoundData && handleGenerateBriefing(currentRoundData.id)}
              disabled={!currentRoundData}
            >
              {locale === 'fr' ? '✦ Générer le briefing' : '✦ Generate briefing'}
            </PrimaryButton>
          )}
          {generatingBriefing && <AIProgress steps={briefingSteps} />}
          {errorBlock}
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
              → {t('nav.capture')}
            </PrimaryButton>
          </div>
        </div>
      )}

      {isLatestRound && roundState === 'SCORED' && (
        <div className="mb-6">
          {!generatingBriefing && (
            <div className="flex items-center gap-3">
              <div className="flex-1" />
              <PrimaryButton onClick={handleStartNextRound}>
                {locale === 'fr' ? `✦ Créer le briefing du round ${deal.current_round + 1} →` : `✦ Create round ${deal.current_round + 1} briefing →`}
              </PrimaryButton>
            </div>
          )}
          {generatingBriefing && (
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
              <AIProgress steps={briefingSteps} />
            </div>
          )}
          {errorBlock}
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
            gate={layer === 4 ? null : dealState.gates[layer]}
            momentum={layer === 4 ? dealState.momentum : null}
          />
        ))}
      </div>

    </div>
  )
}
