'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import {
  type Deal, type DealRound, type BriefingQuestion, type BriefingObjection,
  type QuestionTemplate,
  LAYER_LABELS, getLayerVerdict,
} from '@/lib/types'
import RoundTimeline from '@/components/deal/RoundTimeline'
import { useRole } from '@/lib/role-context'

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
  const { t } = useI18n()
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
      <div className="text-xs font-medium text-neutral-700">{t(`layer.${layer}` as any)}</div>
      <span className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${verdictStyle}`}>{verdict}</span>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────

export default function BriefingPage() {
  const params = useParams()
  const router = useRouter()
  const dealId = params.id as string
  const { t, locale } = useI18n()
  const { organizationId } = useRole()

  const [deal, setDeal] = useState<Deal | null>(null)
  const [orgTemplates, setOrgTemplates] = useState<QuestionTemplate[]>([])
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([])
  const [rounds, setRounds] = useState<DealRound[]>([])
  const [selectedRound, setSelectedRound] = useState<number>(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [translating, setTranslating] = useState(false)
  const [translateSuccess, setTranslateSuccess] = useState<string | null>(null)

  const [line, setLine] = useState('')
  const [read, setRead] = useState('')
  const [angle, setAngle] = useState('')
  const [winCondition, setWinCondition] = useState('')
  const [questions, setQuestions] = useState<BriefingQuestion[]>([])
  const [doNot, setDoNot] = useState<string[]>([])
  const [mirror, setMirror] = useState<string[]>([])
  const [objections, setObjections] = useState<BriefingObjection[]>([])
  const [mandatoryQuestions, setMandatoryQuestions] = useState<string[]>([])

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
    setMandatoryQuestions(r?.mandatory_questions ?? [])
    setSelectedTemplateIds(r?.selected_templates ?? [])
  }

  const load = useCallback(async () => {
    const supabase = createClient()
    const [{ data: dealData }, { data: roundData }] = await Promise.all([
      supabase.from('deals').select('*').eq('id', dealId).single(),
      supabase.from('deal_rounds').select('*').eq('deal_id', dealId).order('round', { ascending: true }),
    ])
    if (organizationId) {
      const { data: tplData } = await supabase.from('question_templates').select('*').eq('organization_id', organizationId).order('created_at')
      if (tplData) setOrgTemplates(tplData as QuestionTemplate[])
    }

    if (dealData) setDeal(dealData)
    if (roundData) {
      setRounds(roundData)
      const latest = roundData[roundData.length - 1]
      if (latest) {
        setSelectedRound(latest.round)
        populateFromRound(latest)
      }
    }
  }, [dealId, organizationId])

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
        mandatory_questions: mandatoryQuestions,
        selected_templates: selectedTemplateIds,
      })
      .eq('id', currentRoundData.id)
    if (error) setError(error.message)
    else await load()
    setSaving(false)
  }

  async function handleTranslate() {
    if (!currentRoundData) return
    setTranslating(true)
    setTranslateSuccess(null)
    try {
      const data: Record<string, unknown> = {
        briefing_line: line, briefing_read: read, briefing_angle: angle,
        briefing_win_condition: winCondition, briefing_questions: questions,
        briefing_do_not: doNot, briefing_mirror: mirror, briefing_objections: objections,
        mandatory_questions: mandatoryQuestions,
      }
      if (currentRoundData.capture_notes) data.capture_notes = currentRoundData.capture_notes
      if (currentRoundData.narrative) data.narrative = currentRoundData.narrative
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, locale }),
      })
      const result = await res.json()
      if (result.data) {
        const d = result.data
        if (d.briefing_line != null) setLine(d.briefing_line)
        if (d.briefing_read != null) setRead(d.briefing_read)
        if (d.briefing_angle != null) setAngle(d.briefing_angle)
        if (d.briefing_win_condition != null) setWinCondition(d.briefing_win_condition)
        if (d.briefing_questions) setQuestions(d.briefing_questions)
        if (d.briefing_do_not) setDoNot(d.briefing_do_not)
        if (d.briefing_mirror) setMirror(d.briefing_mirror)
        if (d.briefing_objections) setObjections(d.briefing_objections)
        if (d.mandatory_questions) setMandatoryQuestions(d.mandatory_questions)
        const supabase = createClient()
        await supabase.from('deal_rounds').update(d).eq('id', currentRoundData.id)
        setTranslateSuccess(t('common.translated'))
        await load()
      }
    } catch { /* ignore */ }
    setTranslating(false)
  }

  // ── Mandatory question helpers ────────────────────────────
  function addMandatory() { setMandatoryQuestions(m => [...m, '']) }
  function updateMandatory(i: number, val: string) { setMandatoryQuestions(m => m.map((item, idx) => idx === i ? val : item)) }
  function removeMandatory(i: number) { setMandatoryQuestions(m => m.filter((_, idx) => idx !== i)) }

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
            {t('capture.backToPipeline')}
          </button>
          <h1 className="text-2xl font-bold text-neutral-900">
            Briefing · <span className="text-neutral-400 font-normal">{deal.prospect_name}</span>
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Round {selectedRound === 0 ? '0 (initial)' : selectedRound}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isLatestRound && (
            <>
              <button
                onClick={handleTranslate}
                disabled={translating}
                className="px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-200 rounded-xl hover:border-blue-400 hover:text-blue-600 transition-all disabled:opacity-40"
              >
                {translating ? t('common.translating') : t('common.translateContent')}
              </button>
              {translateSuccess && <span className="text-xs text-emerald-600 font-medium">{translateSuccess}</span>}
            </>
          )}
        </div>
      </div>

      {/* Round timeline */}
      <RoundTimeline nodes={nodes} currentRound={selectedRound} onSelect={handleSelectRound} />

      {/* Historical notice */}
      {!isLatestRound && (
        <div className="mb-5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 font-medium">
          {t('capture.historical')}
        </div>
      )}

      {/* The Angle */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-6 mb-5 text-white shadow-lg shadow-blue-500/20">
        <div className="text-xs font-semibold uppercase tracking-wide text-blue-200 mb-3">{t('briefing.theAngle')}</div>
        {isLatestRound ? (
          <textarea
            value={angle}
            onChange={e => { setAngle(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
            ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
            placeholder={t('briefing.angleSubtitle')}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-base placeholder:text-blue-200 focus:outline-none focus:ring-2 focus:ring-white/30 resize-none overflow-hidden"
          />
        ) : (
          <p className="text-base font-medium leading-relaxed whitespace-pre-wrap">{angle || '—'}</p>
        )}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[1, 2, 3, 4].map((l, i) => (
            <StatusBand key={l} layer={l} verdict={verdicts[i]} />
          ))}
        </div>
      </div>

      {/* Mandatory Questions */}
      <Section title={t('briefing.mandatoryQuestions')} subtitle={t('briefing.mandatorySubtitle')} accent="bg-red-500" defaultOpen={true}>
        {/* Template questions from org bank */}
        {orgTemplates.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">{t('team.questionsDesc')}</div>
            <div className="space-y-1.5">
              {orgTemplates.map(tpl => {
                const active = selectedTemplateIds.includes(tpl.id)
                return (
                  <label key={tpl.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${active ? 'border-red-300 bg-red-50' : 'border-neutral-200 bg-neutral-50 hover:border-red-200'}`}>
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => {
                        if (!isLatestRound) return
                        setSelectedTemplateIds(ids =>
                          active ? ids.filter(id => id !== tpl.id) : [...ids, tpl.id]
                        )
                      }}
                      disabled={!isLatestRound}
                      className="accent-red-500"
                    />
                    <span className={`text-sm ${active ? 'text-red-800 font-medium' : 'text-neutral-600'}`}>{tpl.text}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        {/* Custom mandatory questions for this round */}
        <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">{t('briefing.addMandatory')}</div>
        <div className="space-y-2">
          {mandatoryQuestions.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
              {isLatestRound ? (
                <>
                  <input
                    value={item}
                    onChange={e => updateMandatory(i, e.target.value)}
                    placeholder={t('briefing.mandatoryPlaceholder')}
                    className="flex-1 bg-red-50 border border-red-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                  <button onClick={() => removeMandatory(i)} className="text-red-300 hover:text-red-500 transition-colors">✕</button>
                </>
              ) : (
                <p className="text-sm text-neutral-700">{item}</p>
              )}
            </div>
          ))}
        </div>
        {isLatestRound && (
          <button onClick={addMandatory} className="mt-3 text-sm font-medium text-red-500 hover:text-red-600 transition-colors">+ {t('briefing.addMandatory')}</button>
        )}
      </Section>

      {/* Field Questions */}
      <Section title={t('briefing.fieldQuestions')} subtitle={t('briefing.questionsSubtitle')} accent="bg-violet-400" defaultOpen={false}>
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
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">{t('briefing.opportunisticCapture')}</span>
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
      <Section title={t('briefing.objections')} subtitle={t('briefing.objectionsSubtitle')} accent="bg-amber-400" defaultOpen={false}>
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
      <Section title={t('briefing.doNot')} subtitle={t('briefing.doNotSubtitle')} accent="bg-rose-400" defaultOpen={false}>
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
      <Section title={t('briefing.winCondition')} subtitle={t('briefing.winConditionSubtitle')} accent="bg-emerald-400" defaultOpen={false}>
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
            {saving ? t('capture.saving') : t('capture.save')}
          </button>
          <button
            onClick={() => router.push(`/deals/${dealId}/capture`)}
            className="px-6 py-3 bg-white text-neutral-700 text-sm font-medium rounded-xl border border-neutral-200 hover:border-neutral-400 hover:shadow-sm transition-all"
          >
            {t('briefing.goCapture')}
          </button>
          {error && <span className="text-sm text-rose-600">{error}</span>}
        </div>
      )}
    </div>
  )
}
