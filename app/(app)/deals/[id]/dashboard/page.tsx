'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  type Deal, type DealRound, type EvidenceLevel, type SourceAuthority,
  LAYER_VARIABLES,
  isLegacyDimensions,
} from '@/lib/types'
import {
  criterionScore, computeDealState, DECISIVE_VARS,
  type GateInfo, type MomentumInfo,
} from '@/lib/scoring'
import { evidenceFromDeclarations, type Declaration } from '@/lib/voice-credit'
import { inheritedRoundFields, scoreUpdateFromSuggestions, isRoundUnstarted, roundState as computeRoundState, hasCapture as roundHasCapture, type ScoreSuggestion } from '@/lib/deal-rounds'
import RoundTimeline from '@/components/deal/RoundTimeline'
import { normalizePlaybook, type Playbook } from '@/lib/playbook'
import {
  actorCoverage, normalizeFit, AXIS_CRITERION, ACTORS_CRITERION, FIT_AXIS_LABELS,
  type DealContact, type PlaybookFit, type FitVerdict,
} from '@/lib/playbook-fit'
import PlaybookFitCard from '@/components/deal/PlaybookFitCard'
import PastConversationImport from '@/components/deal/PastConversationImport'
import { normalizeSellerRead, readGap, CONFIDENCE_LEVELS } from '@/lib/seller-read'
import AIProgress from '@/components/ui/AIProgress'
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

// The playbook verdict shown beside a criterion. Deliberately a marker, not a
// number: the fit is a separate reading and must not look like part of the score.
function FitDot({ verdict, title }: { verdict: FitVerdict; title: string }) {
  const dot = verdict === 'aligned' ? 'bg-emerald-500'
    : verdict === 'partial' ? 'bg-amber-500'
    : verdict === 'mismatch' ? 'bg-rose-500'
    : 'bg-neutral-300'
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 cursor-help ${dot}`} title={title} />
}

function VariableRow({ label, rationale, fitMarker, children }: { label: string; rationale?: string; fitMarker?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm text-neutral-700 font-medium flex items-center gap-1.5">
        <span>{label}</span>
        {fitMarker}
      </div>
      {children}
      {rationale && (
        <p className="text-[11px] text-neutral-500 mt-1 pl-2 border-l-2 border-neutral-200 leading-relaxed italic">{rationale}</p>
      )}
    </div>
  )
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
  gate,
  momentum,
  fitMarkerFor,
}: {
  layer: number
  round: DealRound | null
  gate: GateInfo | null
  momentum: MomentumInfo | null
  fitMarkerFor: (variable: string) => React.ReactNode
}) {
  const { t, locale } = useI18n()
  const vars = LAYER_VARIABLES[layer as keyof typeof LAYER_VARIABLES]
  const colors = LAYER_COLORS[layer]
  const isMomentum = layer === 4

  // Voice-credit alarms across this card's criteria (advocate voicing doubt).
  const allDeclarations = (round?.declarations ?? {}) as Record<string, Declaration[]>
  const cardAlarms = vars.flatMap(v => evidenceFromDeclarations(v, allDeclarations[v]).alarms).map(a => {
    const roleLabel = t(`voiceRole.${a.role}` as never)
    const varLabel = t(`var.${a.variable}` as never)
    return locale === 'fr'
      ? `Signal d'alarme — ${roleLabel} exprime un doute sur ${varLabel}.`
      : `Alarm signal — ${roleLabel} voices doubt on ${varLabel}.`
  })

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
          const currentValue = round?.[field] as number | null
          const evidenceLevels = round?.evidence_levels ?? {}
          const authorityLevels = (round?.authority_levels ?? {}) as Record<string, SourceAuthority>
          const currentEvidence: EvidenceLevel = evidenceLevels[v] ?? 'declared'
          const currentAuthority: SourceAuthority = authorityLevels[v] ?? 'end_user'
          const rationale = (round?.rationales ?? {})[v] as string | undefined
          const label = DECISIVE_VARS[layer]?.includes(v) ? `⚡ ${t(`var.${v}` as any)}` : t(`var.${v}` as any)
          const hasEvidence = currentValue !== null && evidenceLevels[v] !== undefined
          return (
            <VariableRow key={v} label={label} rationale={rationale} fitMarker={fitMarkerFor(v)}>
              <ScoreBar variable={v} score={currentValue} evidence={hasEvidence || currentValue !== null ? currentEvidence : undefined} authority={currentAuthority} declarations={allDeclarations[v]} />
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


// ── Page ─────────────────────────────────────────────────────

export default function DealDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const { t, locale } = useI18n()
  const dealId = params.id as string

  const [deal, setDeal] = useState<Deal | null>(null)
  const [rounds, setRounds] = useState<DealRound[]>([])
  const [selectedRound, setSelectedRound] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [generatingBriefing, setGeneratingBriefing] = useState(false)
  const [stakeholders, setStakeholders] = useState<DealContact[]>([])
  const [playbook, setPlaybook] = useState<Playbook | null>(null)
  const [fit, setFit] = useState<PlaybookFit | null>(null)
  const [fitLoading, setFitLoading] = useState(false)
  const [fitError, setFitError] = useState<string | null>(null)
  const [importingPast, setImportingPast] = useState(false)
  const [importPastError, setImportPastError] = useState<string | null>(null)

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
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: dealData }, { data: roundData }, { data: stakeholderData }, { data: vendorData }] = await Promise.all([
      supabase.from('deals').select('*').eq('id', dealId).single(),
      supabase.from('deal_rounds').select('*').eq('deal_id', dealId).order('round', { ascending: true }),
      supabase.from('deal_stakeholders').select('name, actor_type, actor_types').eq('deal_id', dealId),
      user
        ? supabase.from('vendors').select('playbook, locale').eq('user_id', user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    setStakeholders(stakeholderData ?? [])
    setPlaybook(vendorData?.playbook ? normalizePlaybook(vendorData.playbook, locale) : null)
    if (dealData) {
      setDeal(dealData)
      setFit(normalizeFit(dealData.playbook_fit))
    }
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
  }, [dealId, locale])

  useEffect(() => { load() }, [load])

  async function handleAnalyzeFit() {
    setFitLoading(true)
    setFitError(null)
    try {
      const res = await fetch('/api/ai/playbook-fit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, locale }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `Failed (${res.status})`)
      setFit(normalizeFit(data.fit))
    } catch (e) {
      setFitError(e instanceof Error ? e.message : 'Failed to evaluate the fit')
    }
    setFitLoading(false)
  }

  async function handleGenerateBriefing(roundId: string) {
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
      router.push(`/deals/${dealId}/briefing`)
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Failed to generate briefing'
      const { message, detail } = humanizeError(raw, t as (k: never) => string)
      setError(message)
      setErrorDetail(detail ?? null)
      setGeneratingBriefing(false)
    }
  }

  // Bring a conversation that happened before this deal reached Switch into
  // the diagnostic: one transcript becomes one round, scored exactly like a
  // captured one. No briefing exists for it, and none is invented.
  async function handleImportPastConversation(payload: { file?: File; text?: string }) {
    if (!deal) return
    setImportingPast(true)
    setImportPastError(null)
    try {
      const supabase = createClient()

      const formData = new FormData()
      if (payload.file) formData.append('file', payload.file)
      if (payload.text) formData.append('text', payload.text)
      formData.append('locale', locale)
      const parseRes = await fetch('/api/ai/parse-transcript', { method: 'POST', body: formData })
      const parsed = await parseRes.json().catch(() => ({}))
      if (!parseRes.ok) throw new Error(parsed.error ?? `Transcript could not be read (${parseRes.status})`)

      const notes = (parsed.notes ?? {}) as Record<string, string>
      const hasContent = Object.values(notes).some(v => typeof v === 'string' && v.trim())
      if (!hasContent) {
        throw new Error(locale === 'fr'
          ? 'Rien d’exploitable n’a été extrait de ce transcript.'
          : 'Nothing usable could be extracted from this transcript.')
      }

      // Each imported conversation is its own round, so momentum can be read
      // across them. Scores carry over the same way a normal round does — but
      // an empty round left by an interrupted briefing is filled in, not
      // skipped over.
      const current = rounds.find(r => r.round === deal.current_round)
      const reusable = isRoundUnstarted(current) ? current! : null
      const nextRound = reusable ? reusable.round : deal.current_round + 1
      const inherited = reusable ? {} : inheritedRoundFields(current)

      const { data: newRound, error: insertErr } = reusable
        ? await supabase
          .from('deal_rounds')
          .update({ capture_notes: notes, capture_speakers: parsed.speakers ?? [] })
          .eq('id', reusable.id)
          .select()
          .single()
        : await supabase
          .from('deal_rounds')
          .insert({
            deal_id: dealId,
            round: nextRound,
            ...inherited,
            capture_notes: notes,
            capture_speakers: parsed.speakers ?? [],
          })
          .select()
          .single()
      if (insertErr || !newRound) throw new Error(insertErr?.message ?? 'Could not create the round')
      if (!reusable) await supabase.from('deals').update({ current_round: nextRound }).eq('id', dealId)

      const scoresRes = await fetch('/api/ai/suggest-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, roundId: newRound.id, locale }),
      })
      const scoreData = await scoresRes.json().catch(() => ({}))
      if (!scoresRes.ok) throw new Error(scoreData.error ?? 'Scoring failed')

      const suggestions = (scoreData.suggestions ?? {}) as Record<string, ScoreSuggestion>
      await supabase.from('deal_rounds')
        .update(scoreUpdateFromSuggestions(newRound, suggestions))
        .eq('id', newRound.id)

      await Promise.all([
        fetch('/api/ai/update-boxes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealId, roundId: newRound.id, locale }),
        }).catch(() => {}),
        fetch('/api/ai/read', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealId, roundId: newRound.id, locale }),
        }).catch(() => {}),
        fetch('/api/ai/playbook-fit', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealId, locale }),
        }).catch(() => {}),
      ])

      await load()
      setSelectedRound(nextRound)
    } catch (e) {
      setImportPastError(e instanceof Error ? e.message : 'Import failed')
    }
    setImportingPast(false)
  }

  async function handleStartNextRound() {
    if (!deal) return
    setGeneratingBriefing(true)
    setError(null)
    try {
      const supabase = createClient()
      // A previous attempt may have created the round and then been
      // interrupted — a browser Back mid-generation is enough. Reuse that
      // empty round rather than opening another on top of it.
      const current = rounds.find(r => r.round === deal.current_round)
      if (isRoundUnstarted(current)) {
        setSelectedRound(current!.round)
        await handleGenerateBriefing(current!.id)
        return
      }

      const nextRound = deal.current_round + 1
      const inheritedScores = inheritedRoundFields(current)

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
  const hasCapture = roundHasCapture(currentRoundData)
  const roundState = computeRoundState(currentRoundData)
  const dealState = computeDealState(rounds, selectedRound)

  // On the Départ view: is round 1 already briefed but not yet captured?
  // (When it IS captured, load() defaults away from R0.)
  const inProgressRound = rounds.find(r => r.round === deal.current_round) ?? null
  const round1Briefed = deal.current_round >= 1 && !!inProgressRound?.briefing_line

  // Guard: a briefing built on an empty prospect context is hollow and still
  // burns tokens. Round 1 has no gate scores by design — those come from the
  // first conversation — so the prerequisite is the context, not the scores.
  const MIN_CONTEXT_FIELDS = 5
  const contextFieldsFilled = (() => {
    const d = deal.prospect_dimensions
    if (!d) return 0
    // Legacy deals have a different shape — never block those.
    if (isLegacyDimensions(d)) return MIN_CONTEXT_FIELDS
    return (d.dimensions ?? []).reduce((acc, dim) => acc + dim.fields.filter(f => (f.value ?? '').trim()).length, 0)
  })()
  const contextTooThin = contextFieldsFilled < MIN_CONTEXT_FIELDS

  const contextGuard = contextTooThin ? (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-left">
      <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
        {locale === 'fr' ? 'Contexte prospect insuffisant' : 'Prospect context too thin'}
      </div>
      <p className="text-sm text-amber-800 mb-3">
        {locale === 'fr'
          ? `Seulement ${contextFieldsFilled} champ${contextFieldsFilled > 1 ? 's' : ''} renseigné${contextFieldsFilled > 1 ? 's' : ''}. Un briefing généré sur un contexte vide ne vous apprendra rien. Complétez au moins ${MIN_CONTEXT_FIELDS} champs.`
          : `Only ${contextFieldsFilled} field${contextFieldsFilled > 1 ? 's' : ''} filled in. A briefing built on an empty context will tell you nothing. Fill in at least ${MIN_CONTEXT_FIELDS} fields.`}
      </p>
      <PrimaryButton onClick={() => router.push(`/deals/${dealId}/context`)}>
        {locale === 'fr' ? '→ Compléter le contexte' : '→ Complete the context'}
      </PrimaryButton>
    </div>
  ) : null

  // Which criteria carry a playbook verdict, and what it says on hover.
  const coverage = playbook ? actorCoverage(playbook, stakeholders) : null
  function fitMarkerFor(variable: string): React.ReactNode {
    if (variable === ACTORS_CRITERION && coverage?.applicable) {
      const missing = coverage.missing
      const verdict: FitVerdict = missing.length === 0 ? 'aligned' : 'partial'
      const title = missing.length === 0
        ? (locale === 'fr' ? 'Playbook A5 — tous les rôles nécessaires sont couverts.' : 'Playbook A5 — every necessary role is covered.')
        : (locale === 'fr' ? `Playbook A5 — manquant : ${missing.map(m => m.label).join(', ')}` : `Playbook A5 — missing: ${missing.map(m => m.label).join(', ')}`)
      return <FitDot verdict={verdict} title={title} />
    }
    const axis = fit?.axes.find(a => AXIS_CRITERION[a.key] === variable)
    if (!axis) return null
    const name = FIT_AXIS_LABELS[axis.key][locale === 'fr' ? 'fr' : 'en']
    const title = [
      `${locale === 'fr' ? 'Adéquation playbook' : 'Playbook fit'} · ${name}`,
      axis.summary,
      axis.reason ? `${locale === 'fr' ? 'Pourquoi : ' : 'Why: '}${axis.reason}` : '',
      axis.playbook_ref ? `${locale === 'fr' ? 'Playbook : ' : 'Playbook: '}${axis.playbook_ref}` : '',
      axis.gap ? `${locale === 'fr' ? 'À trancher : ' : 'To settle: '}${axis.gap}` : '',
    ].filter(Boolean).join('\n')
    return <FitDot verdict={axis.verdict} title={title} />
  }

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
        onSelect={r => setSelectedRound(r)}
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
                {locale === 'fr' ? 'Consultez le briefing, menez la conversation, puis capturez les réponses.' : 'Review the briefing, run the conversation, then capture the answers.'}
              </p>
              <PrimaryButton onClick={() => router.push(`/deals/${dealId}/briefing`)}>→ Briefing</PrimaryButton>
            </div>
          )}
          {!generatingBriefing && !round1Briefed && (contextGuard ?? (
            <div className="space-y-4">
              {/* Two starting points: a deal that begins now, and one that
                  was already running before it reached Switch. */}
              {!importingPast && (
                <div className="bg-white rounded-xl border border-neutral-200 px-5 py-4">
                  <div className="text-sm font-semibold text-neutral-800">
                    {locale === 'fr' ? 'Vous n’avez pas encore parlé au prospect ?' : 'Have you not spoken to the prospect yet?'}
                  </div>
                  <p className="text-sm text-neutral-600 mt-1 mb-3">
                    {locale === 'fr'
                      ? 'Les portes sont vides, c’est normal : elles se remplissent à partir de votre première conversation. Le briefing est construit sur votre Sales Playbook et le contexte prospect.'
                      : 'The gates are empty, and that is expected: they fill in from your first conversation. The briefing is built from your Sales Playbook and the prospect context.'}
                  </p>
                  <PrimaryButton onClick={handleStartNextRound} disabled={generatingBriefing}>
                    {locale === 'fr' ? `✦ Créer le briefing du round ${deal.current_round + 1}` : `✦ Create round ${deal.current_round + 1} briefing`}
                  </PrimaryButton>
                </div>
              )}

              <PastConversationImport
                locale={locale}
                busy={importingPast}
                error={importPastError}
                onImport={handleImportPastConversation}
              />
            </div>
          ))}
          {generatingBriefing && <AIProgress steps={briefingSteps} />}
          {errorBlock}
        </div>
      )}

      {/* ── The Read — only once the round is captured (post-conversation read) ── */}
      {selectedRound !== 0 && currentRoundData?.briefing_read && hasCapture && (
        <div className="mb-6 bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-6 rounded-full bg-neutral-400" />
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{t('briefing.theRead')}</span>
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
          {!generatingBriefing && (contextGuard ?? (
            <PrimaryButton
              onClick={() => currentRoundData && handleGenerateBriefing(currentRoundData.id)}
              disabled={!currentRoundData}
            >
              {locale === 'fr' ? '✦ Générer le briefing' : '✦ Generate briefing'}
            </PrimaryButton>
          ))}
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
              {locale === 'fr' ? 'Consultez le briefing, puis menez la conversation.' : 'Review the briefing, then run the conversation.'}
            </p>
          </div>
          <div className="flex-shrink-0 ml-6">
            <PrimaryButton onClick={() => router.push(`/deals/${dealId}/briefing`)}>
              → Briefing
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

      {/* The seller's read against the evidence. Only speaks when the two
          disagree — when they agree, silence is the right output. */}
      {(() => {
        const read = normalizeSellerRead((currentRoundData as unknown as { seller_read?: unknown } | null)?.seller_read)
        const gap = readGap(read, currentRoundData)
        if (!gap || gap.kind === 'aligned') return null
        const optimistic = gap.kind === 'optimistic'
        const conf = CONFIDENCE_LEVELS.find(c => c.value === gap.confidence)
        return (
          <div className={`mb-6 rounded-2xl border px-5 py-4 ${optimistic ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'}`}>
            <div className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${optimistic ? 'text-amber-600' : 'text-blue-600'}`}>
              {locale === 'fr' ? 'Écart de lecture' : 'Reading gap'}
            </div>
            <p className={`text-sm font-medium ${optimistic ? 'text-amber-800' : 'text-blue-800'}`}>
              {optimistic
                ? (locale === 'fr'
                  ? 'Vous sentez ce deal mieux que les preuves ne le montrent.'
                  : 'You feel better about this deal than the evidence shows.')
                : (locale === 'fr'
                  ? 'Les preuves sont meilleures que votre ressenti.'
                  : 'The evidence is better than your read.')}
            </p>
            <p className="text-xs text-neutral-600 mt-1">
              {locale === 'fr' ? 'Votre pari : ' : 'Your bet: '}
              <strong>{conf ? (locale === 'fr' ? conf.fr : conf.en) : gap.confidence}</strong>
              {' · '}
              {locale === 'fr' ? 'Porte 1 : ' : 'Gate 1: '}
              <strong>{gap.evidence.toFixed(1)}/5</strong>
            </p>
            <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
              {optimistic
                ? (locale === 'fr'
                  ? 'Qu’est-ce qui vous fait dire ça ? Si c’est réel, allez le faire dire au prospect — sinon ça ne compte pas.'
                  : 'What makes you say that? If it is real, get the prospect to say it — otherwise it does not count.')
                : (locale === 'fr'
                  ? 'Quelque chose vous gêne que les notes ne montrent pas. Nommez-le : c’est souvent le vrai sujet du prochain échange.'
                  : 'Something bothers you that the notes do not show. Name it: it is often the real subject of the next conversation.')}
            </p>
            {read?.note && (
              <p className="text-xs text-neutral-600 mt-2 pl-3 border-l-2 border-neutral-300 italic">{read.note}</p>
            )}
          </div>
        )
      })()}

      {/* Playbook fit — a second reading, beside the gates, never inside them */}
      {playbook && coverage && (
        <PlaybookFitCard
          coverage={coverage}
          fit={fit}
          locale={locale}
          dealId={dealId}
          onAnalyze={handleAnalyzeFit}
          analyzing={fitLoading}
          error={fitError}
        />
      )}

      {/* Layer cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {[1, 2, 3, 4].map(layer => (
          <LayerCard
            key={layer}
            layer={layer}
            round={currentRoundData}
            gate={layer === 4 ? null : dealState.gates[layer]}
            momentum={layer === 4 ? dealState.momentum : null}
            fitMarkerFor={fitMarkerFor}
          />
        ))}
      </div>

    </div>
  )
}
