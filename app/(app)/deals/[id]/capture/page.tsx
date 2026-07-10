'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { type Deal, type DealRound, type BriefingQuestion } from '@/lib/types'
import RoundTimeline from '@/components/deal/RoundTimeline'
import { useI18n } from '@/lib/i18n/context'

export default function CapturePage() {
  const params = useParams()
  const router = useRouter()
  const { t, locale } = useI18n()
  const dealId = params.id as string

  const [deal, setDeal] = useState<Deal | null>(null)
  const [rounds, setRounds] = useState<DealRound[]>([])
  const [selectedRound, setSelectedRound] = useState<number>(0)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [freeNote, setFreeNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestingScores, setSuggestingScores] = useState(false)
  const [parsingTranscript, setParsingTranscript] = useState(false)
  const [transcriptSuccess, setTranscriptSuccess] = useState<string | null>(null)
  const [translating, setTranslating] = useState(false)
  const [translateSuccess, setTranslateSuccess] = useState<string | null>(null)

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
      const supabase = createClient()
      const { error: saveErr } = await supabase
        .from('deal_rounds')
        .update({ capture_notes: merged })
        .eq('id', currentRoundData.id)
      if (saveErr) throw new Error(saveErr.message)

      const res = await fetch('/api/ai/suggest-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, roundId: currentRoundData.id, locale }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'AI error')

      const suggestions: Record<string, { score: number; evidence: string; authority: string; rationale: string }> = data.suggestions
      const scoreUpdate: Record<string, number> = {}
      const evidenceLevels: Record<string, string> = { ...(currentRoundData.evidence_levels ?? {}) }
      const authorityLevels: Record<string, string> = { ...((currentRoundData as Record<string, unknown>).authority_levels as Record<string, string> ?? {}) }
      const rationales: Record<string, string> = { ...(currentRoundData.rationales ?? {}) }
      for (const [variable, s] of Object.entries(suggestions)) {
        if (s.score !== null) scoreUpdate[variable] = s.score
        if (s.evidence) evidenceLevels[variable] = s.evidence
        if (s.authority) authorityLevels[variable] = s.authority
        if (s.rationale) rationales[variable] = s.rationale
      }
      const { error: updateErr } = await supabase.from('deal_rounds').update({ ...scoreUpdate, evidence_levels: evidenceLevels, authority_levels: authorityLevels, rationales }).eq('id', currentRoundData.id)
      if (updateErr) throw new Error(updateErr.message)

      fetch('/api/ai/update-boxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, roundId: currentRoundData.id, locale }),
      }).catch(() => {})

      router.push(`/deals/${dealId}/dashboard`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to analyze')
      setSuggestingScores(false)
    }
  }

  async function handleImportTranscript(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentRoundData) return
    setParsingTranscript(true)
    setError(null)
    setTranscriptSuccess(null)
    try {
      const questionPayload = questions.map((q, i) => ({
        key: q.variable || (q.priority === 'opportunistic' ? `opp-${i}` : String(i)),
        variable: q.variable,
        text: q.text,
        intent: q.intent,
      }))
      const formData = new FormData()
      formData.append('file', file)
      formData.append('questions', JSON.stringify(questionPayload))
      formData.append('locale', locale)
      const res = await fetch('/api/ai/parse-transcript', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok || data.error) { setError(data.error ?? 'Failed'); return }
      const parsed = data.notes as Record<string, string>
      for (const [key, val] of Object.entries(parsed)) {
        if (key === '__free__' && val) {
          setFreeNote(prev => prev ? `${prev}\n\n${val}` : val)
        } else if (val) {
          setNotes(prev => ({ ...prev, [key]: prev[key] ? `${prev[key]}\n\n${val}` : val }))
        }
      }
      setTranscriptSuccess(t('capture.transcriptImported'))
    } catch {
      setError('Network error — try again')
    } finally {
      setParsingTranscript(false)
      e.target.value = ''
    }
  }

  async function handleTranslate() {
    if (!currentRoundData) return
    setTranslating(true)
    setTranslateSuccess(null)
    try {
      const r = currentRoundData
      const data: Record<string, unknown> = {
        capture_notes: { ...notes, __free__: freeNote },
      }
      if (r.briefing_line) data.briefing_line = r.briefing_line
      if (r.briefing_read) data.briefing_read = r.briefing_read
      if (r.briefing_angle) data.briefing_angle = r.briefing_angle
      if (r.briefing_win_condition) data.briefing_win_condition = r.briefing_win_condition
      if (r.briefing_questions?.length) data.briefing_questions = r.briefing_questions
      if (r.briefing_do_not?.length) data.briefing_do_not = r.briefing_do_not
      if (r.briefing_mirror?.length) data.briefing_mirror = r.briefing_mirror
      if (r.briefing_objections?.length) data.briefing_objections = r.briefing_objections
      if (r.narrative) data.narrative = r.narrative

      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, locale }),
      })
      const result = await res.json()
      if (result.data) {
        const d = result.data
        if (d.capture_notes) {
          const translated = d.capture_notes as Record<string, string>
          const free = translated.__free__ ?? ''
          delete translated.__free__
          setNotes(translated)
          setFreeNote(free)
          d.capture_notes = { ...translated, __free__: free }
        }
        const supabase = createClient()
        await supabase.from('deal_rounds').update(d).eq('id', currentRoundData.id)
        setTranslateSuccess(t('common.translated'))
        await load()
      }
    } catch { /* ignore */ }
    setTranslating(false)
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
            {t('capture.backToPipeline')}
          </button>
          <h1 className="text-2xl font-bold text-neutral-900">
            Capture · <span className="text-neutral-400 font-normal">{deal.prospect_name}</span>
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

      {/* Briefing required blocker */}
      {isLatestRound && !hasBriefing && (
        <div className="mb-8 bg-white rounded-2xl border-2 border-dashed border-neutral-200 p-10 text-center">
          <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📋</span>
          </div>
          <h3 className="text-lg font-semibold text-neutral-800 mb-1">{t('capture.briefingRequired')}</h3>
          <p className="text-sm text-neutral-500 mb-6 max-w-md mx-auto">
            {t('capture.briefingRequiredDesc')}
          </p>
          <button
            onClick={() => router.push(`/deals/${dealId}/dashboard`)}
            className="px-6 py-3 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 transition-all"
          >
            {t('capture.goToDashboard')}
          </button>
        </div>
      )}

      {/* Instruction */}
      {isLatestRound && hasBriefing && (
        <div className="bg-violet-50 border border-violet-200 rounded-2xl px-5 py-4 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-violet-400" />
            <span className="text-xs font-semibold text-violet-600 uppercase tracking-wide">{t('capture.logConversation')}</span>
          </div>
          <p className="text-sm text-violet-700">
            {t('capture.logInstruction')}
          </p>
        </div>
      )}

      {/* Transcript import */}
      {isLatestRound && hasBriefing && (
        <div className="mb-6 flex items-center gap-3 flex-wrap">
          <label className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-neutral-300 text-sm font-medium cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-all ${parsingTranscript ? 'opacity-50 pointer-events-none' : ''}`}>
            <span>📄</span>
            <span>{parsingTranscript ? t('capture.parsing') : t('capture.importTranscript')}</span>
            <input
              type="file"
              accept=".txt,.atxt,.pdf,.md,.vtt,.srt,.docx"
              className="hidden"
              onChange={handleImportTranscript}
              disabled={parsingTranscript}
            />
          </label>
          <span className="text-xs text-neutral-400">{t('capture.importTranscriptHint')}</span>
          {transcriptSuccess && (
            <span className="text-xs text-green-600 font-medium">{transcriptSuccess}</span>
          )}
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
                    <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">L{q.layer} · {t(('var.' + q.variable) as any) || q.variable} · {t('briefing.pressing')}</span>
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
                      placeholder={t('capture.pressingPlaceholder')}
                      rows={3}
                      className={inputClass}
                    />
                  ) : (
                    <div className="bg-neutral-50 rounded-xl p-3 text-sm text-neutral-700 whitespace-pre-wrap min-h-[3rem]">
                      {val || <span className="text-neutral-300">{t('capture.nothingCaptured')}</span>}
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
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">{t('briefing.opportunisticCapture')}</span>
              </div>
              {questions.filter(q => q.priority === 'opportunistic').map((q, i) => {
                const key = q.variable || `opp-${i}`
                const val = notes[key] ?? ''
                return (
                  <div key={`opp-${i}`} className="bg-white rounded-2xl border border-dashed border-neutral-200 overflow-hidden">
                    <div className="bg-neutral-50/50 px-5 py-3 border-b border-neutral-100">
                      <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">L{q.layer} · {t(('var.' + q.variable) as any) || q.variable}</span>
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
                          placeholder={t('capture.opportunisticPlaceholder')}
                          rows={2}
                          className={inputClass}
                        />
                      ) : (
                        <div className="bg-neutral-50 rounded-xl p-3 text-sm text-neutral-600 whitespace-pre-wrap min-h-[2.5rem]">
                          {val || <span className="text-neutral-300">{t('capture.nothingCaptured')}</span>}
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
          <p className="text-sm text-neutral-400 font-medium">{t('capture.noBriefingQuestions')}</p>
          <p className="text-xs text-neutral-400 mt-1">
            <button onClick={() => router.push(`/deals/${dealId}/briefing`)} className="text-blue-500 hover:text-blue-600 underline">
              {t('nav.briefing')}
            </button>
          </p>
        </div>
      )}

      {/* Free-form note */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5 mb-8 shadow-sm">
        <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">{t('capture.freeNote')}</div>
        {isLatestRound ? (
          <textarea
            value={freeNote}
            onChange={e => setFreeNote(e.target.value)}
            placeholder={t('capture.freeNotePlaceholder')}
            rows={5}
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
            {saving ? t('capture.saving') : t('capture.save')}
          </button>
          <button
            onClick={handleAnalyze}
            disabled={suggestingScores || saving}
            className="px-6 py-3 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 disabled:opacity-40 transition-all"
          >
            {suggestingScores ? t('capture.analyzing') : t('capture.analyze')}
          </button>
          {error && <span className="text-sm text-rose-600">{error}</span>}
        </div>
      )}
    </div>
  )
}
