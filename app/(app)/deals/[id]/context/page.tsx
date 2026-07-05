'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { type Deal, type Stakeholder, type ProspectDimensions, EMPTY_PROSPECT_DIMENSIONS } from '@/lib/types'
import { useI18n } from '@/lib/i18n/context'
import { getContextDimensions, type ContextDimDef } from '@/lib/i18n/context-dimensions'

const ACTOR_COLORS: Record<string, string> = {
  champion: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  decision_maker: 'bg-blue-50 text-blue-600 border-blue-200',
  user: 'bg-violet-50 text-violet-600 border-violet-200',
  reviewer: 'bg-amber-50 text-amber-600 border-amber-200',
  blocker: 'bg-rose-50 text-rose-600 border-rose-200',
  unknown: 'bg-neutral-100 text-neutral-500 border-neutral-200',
}

const ACTOR_KEYS: Record<string, string> = {
  champion: 'context.champion',
  decision_maker: 'context.decisionMaker',
  user: 'context.endUser',
  reviewer: 'context.reviewer',
  blocker: 'context.blocker',
  unknown: 'context.unknown',
}

const inputClass = "w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none placeholder:text-neutral-300 transition-all"

function filledCount(dim: Record<string, string>) {
  return Object.values(dim).filter(v => v.trim().length > 0).length
}

function deepMerge(base: ProspectDimensions, saved: Partial<ProspectDimensions>): ProspectDimensions {
  const result = { ...base }
  for (const key of Object.keys(saved) as (keyof ProspectDimensions)[]) {
    if (saved[key]) result[key] = { ...base[key], ...saved[key] } as never
  }
  return result
}

// ── Dimension section ────────────────────────────────────────

function DimensionSection({
  def, values, onChange, onSave, saving, isDirty,
}: {
  def: ContextDimDef
  values: Record<string, string>
  onChange: (key: string, val: string) => void
  onSave: () => void
  saving: boolean
  isDirty: boolean
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const filled = filledCount(values)
  const total = def.questions.length

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-50/50 transition-colors"
      >
        <span className="text-sm font-semibold text-neutral-800">{def.label}</span>
        <div className="flex items-center gap-3">
          {isDirty && <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{t('context.unsaved')}</span>}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${filled === total ? 'text-emerald-600 bg-emerald-50' : filled > 0 ? 'text-amber-600 bg-amber-50' : 'text-neutral-400 bg-neutral-100'}`}>
            {filled}/{total}
          </span>
          <span className="text-neutral-300 text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-neutral-100 px-5 py-5 space-y-5">
          {def.questions.map(q => (
            <div key={q.key}>
              <label className="text-sm font-medium text-neutral-700">{q.label}</label>
              <p className="text-xs text-neutral-400 mt-0.5 mb-2">{q.hint}</p>
              <textarea
                value={values[q.key] ?? ''}
                onChange={e => onChange(q.key, e.target.value)}
                rows={3}
                placeholder="..."
                className={inputClass}
              />
            </div>
          ))}
          {isDirty && (
            <div className="pt-4 border-t border-neutral-100">
              <button
                onClick={onSave}
                disabled={saving}
                className="px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 disabled:opacity-40 transition-all"
              >
                {saving ? t('context.saving') : t('context.saveChanges')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────

export default function AccountContextPage() {
  const { t, locale } = useI18n()
  const DIMENSIONS = getContextDimensions(locale)
  const params = useParams()
  const router = useRouter()
  const dealId = params.id as string

  const [deal, setDeal] = useState<Deal | null>(null)
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([])
  const [dims, setDims] = useState<ProspectDimensions>(EMPTY_PROSPECT_DIMENSIONS)
  const [savedDims, setSavedDims] = useState<ProspectDimensions>(EMPTY_PROSPECT_DIMENSIONS)
  const [savingDim, setSavingDim] = useState<string | null>(null)

  const [companyUrl, setCompanyUrl] = useState('')
  const [importingCompany, setImportingCompany] = useState(false)
  const [companyImportError, setCompanyImportError] = useState<string | null>(null)
  const [companyImportSuccess, setCompanyImportSuccess] = useState<string | null>(null)

  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [importingLinkedin, setImportingLinkedin] = useState(false)
  const [linkedinError, setLinkedinError] = useState<string | null>(null)
  const [linkedinSuccess, setLinkedinSuccess] = useState<string | null>(null)

  const [newStk, setNewStk] = useState({ name: '', role: '', actor_type: 'unknown' as Stakeholder['actor_type'], notes: '' })
  const [addingStk, setAddingStk] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [{ data: dealData }, { data: stkData }] = await Promise.all([
      supabase.from('deals').select('*').eq('id', dealId).single(),
      supabase.from('deal_stakeholders').select('*').eq('deal_id', dealId).order('created_at', { ascending: true }),
    ])
    if (dealData) {
      setDeal(dealData)
      const merged = deepMerge(EMPTY_PROSPECT_DIMENSIONS, dealData.prospect_dimensions ?? {})
      setDims(merged)
      setSavedDims(merged)
    }
    if (stkData) setStakeholders(stkData)
  }, [dealId])

  useEffect(() => { load() }, [load])

  function handleChange(dimKey: keyof ProspectDimensions, subKey: string, val: string) {
    setDims(d => ({ ...d, [dimKey]: { ...d[dimKey], [subKey]: val } }))
  }

  async function handleSaveDim(dimKey: keyof ProspectDimensions) {
    if (!deal) return
    setSavingDim(dimKey)
    const supabase = createClient()
    const merged = { ...(deal.prospect_dimensions ?? {}), [dimKey]: dims[dimKey] }
    await supabase.from('deals').update({ prospect_dimensions: merged }).eq('id', dealId)
    setSavedDims(d => ({ ...d, [dimKey]: dims[dimKey] }))
    await load()
    setSavingDim(null)
  }

  async function saveAllDims(newDims: ProspectDimensions) {
    const supabase = createClient()
    await supabase.from('deals').update({ prospect_dimensions: newDims }).eq('id', dealId)
    setSavedDims(newDims)
  }

  async function handleImportCompanyUrl() {
    if (!companyUrl.trim()) return
    setImportingCompany(true)
    setCompanyImportError(null)
    setCompanyImportSuccess(null)
    try {
      const res = await fetch('/api/context/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: companyUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setCompanyImportError(data.error ?? 'Failed'); return }
      const newDims = deepMerge(dims, data.dimensions)
      setDims(newDims)
      await saveAllDims(newDims)
      setCompanyImportSuccess(t('context.companyImported'))
    } catch {
      setCompanyImportError(t('context.networkError'))
    } finally {
      setImportingCompany(false)
    }
  }

  async function handleImportCompanyDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportingCompany(true)
    setCompanyImportError(null)
    setCompanyImportSuccess(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/context/from-doc', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok || data.error) { setCompanyImportError(data.error ?? 'Failed'); return }
      const newDims = deepMerge(dims, data.dimensions)
      setDims(newDims)
      await saveAllDims(newDims)
      setCompanyImportSuccess(t('context.companyImported'))
    } catch {
      setCompanyImportError(t('context.networkError'))
    } finally {
      setImportingCompany(false)
      e.target.value = ''
    }
  }

  async function handleImportLinkedin() {
    if (!linkedinUrl.trim()) return
    setImportingLinkedin(true)
    setLinkedinError(null)
    setLinkedinSuccess(null)
    try {
      const res = await fetch('/api/context/from-linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkedinUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setLinkedinError(data.error ?? 'Failed'); return }
      const newDims = deepMerge(dims, data.dimensions)
      setDims(newDims)
      await saveAllDims(newDims)
      setLinkedinSuccess(t('context.contactImported'))
    } catch {
      setLinkedinError(t('context.networkError'))
    } finally {
      setImportingLinkedin(false)
    }
  }

  async function handleAddStakeholder() {
    if (!newStk.name) return
    setAddingStk(true)
    const supabase = createClient()
    await supabase.from('deal_stakeholders').insert({
      deal_id: dealId, name: newStk.name,
      role: newStk.role || null, actor_type: newStk.actor_type, notes: newStk.notes || null,
    })
    setNewStk({ name: '', role: '', actor_type: 'unknown', notes: '' })
    await load()
    setAddingStk(false)
  }

  async function handleDeleteStakeholder(id: string) {
    const supabase = createClient()
    await supabase.from('deal_stakeholders').delete().eq('id', id)
    await load()
  }

  if (!deal) return <div className="max-w-4xl mx-auto py-12 px-6 text-sm text-neutral-400">{t('common.loading')}</div>

  const totalFilled = DIMENSIONS.reduce((acc, d) => acc + filledCount(dims[d.key] as Record<string, string>), 0)
  const totalQ = DIMENSIONS.reduce((acc, d) => acc + d.questions.length, 0)
  const importing = importingCompany || importingLinkedin

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <button onClick={() => router.push('/pipeline')} className="text-sm text-neutral-400 hover:text-blue-500 transition-colors mb-1 block">
            {t('capture.backToPipeline')}
          </button>
          <h1 className="text-2xl font-bold text-neutral-900">
            {t('context.title')} · <span className="text-neutral-400 font-normal">{deal.prospect_name}</span>
          </h1>
        </div>
        <div className="text-right">
          <div className="text-xs font-medium text-neutral-400 mb-1">{t('context.completion')}</div>
          <div className={`text-lg font-bold ${totalFilled === totalQ ? 'text-emerald-600' : totalFilled > 0 ? 'text-amber-600' : 'text-neutral-300'}`}>
            {totalFilled}/{totalQ}
          </div>
        </div>
      </div>

      {/* Import panel */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 mb-8 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-700 mb-5">{t('context.importContext')}</h2>

        {/* Company context */}
        <div className="mb-5">
          <div className="text-xs font-medium text-neutral-500 mb-2">{t('context.companyContext')} <span className="text-neutral-300">{t('context.fillsDims13')}</span></div>
          <div className="flex gap-2 mb-2">
            <input
              value={companyUrl}
              onChange={e => setCompanyUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleImportCompanyUrl()}
              placeholder="prospect-company.com"
              disabled={importing}
              className={`flex-1 ${inputClass}`}
            />
            <button
              onClick={handleImportCompanyUrl}
              disabled={importing || !companyUrl.trim()}
              className="px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 disabled:opacity-40 whitespace-nowrap transition-all"
            >
              {importingCompany ? t('context.reading') : t('context.fetch')}
            </button>
          </div>
          <label className={`flex items-center justify-center border-2 border-dashed border-neutral-200 bg-neutral-50 rounded-xl px-4 py-4 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all ${importing ? 'opacity-40 pointer-events-none' : ''}`}>
            <span className="text-sm text-neutral-400">
              {importingCompany ? t('context.readingDoc') : t('context.uploadDoc')}
            </span>
            <input type="file" accept=".pdf,.txt,.md" onChange={handleImportCompanyDoc} className="hidden" disabled={importing} />
          </label>
          {companyImportError && <p className="mt-2 text-sm text-rose-600">{companyImportError}</p>}
          {companyImportSuccess && <p className="mt-2 text-sm text-emerald-600">{companyImportSuccess}</p>}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-neutral-100" />
          <span className="text-xs text-neutral-300">{t('context.contact')}</span>
          <div className="flex-1 h-px bg-neutral-100" />
        </div>

        {/* LinkedIn */}
        <div>
          <div className="text-xs font-medium text-neutral-500 mb-2">{t('context.keyContactLinkedin')} <span className="text-neutral-300">{t('context.fillsDim4')}</span></div>
          <div className="flex gap-2">
            <input
              value={linkedinUrl}
              onChange={e => setLinkedinUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleImportLinkedin()}
              placeholder="linkedin.com/in/contact-name"
              disabled={importing}
              className={`flex-1 ${inputClass}`}
            />
            <button
              onClick={handleImportLinkedin}
              disabled={importing || !linkedinUrl.trim()}
              className="px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 disabled:opacity-40 whitespace-nowrap transition-all"
            >
              {importingLinkedin ? t('context.reading') : t('context.fetch')}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-neutral-300">{t('context.linkedinWarning')}</p>
          {linkedinError && <p className="mt-2 text-sm text-rose-600">{linkedinError}</p>}
          {linkedinSuccess && <p className="mt-2 text-sm text-emerald-600">{linkedinSuccess}</p>}
        </div>
      </div>

      {/* Prospect dimensions */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">{t('context.prospectProfile')}</h2>
        <div className="space-y-3">
          {DIMENSIONS.map(def => (
            <DimensionSection
              key={def.key}
              def={def}
              values={dims[def.key] as Record<string, string>}
              onChange={(subKey, val) => handleChange(def.key, subKey, val)}
              onSave={() => handleSaveDim(def.key)}
              saving={savingDim === def.key}
              isDirty={JSON.stringify(dims[def.key]) !== JSON.stringify(savedDims[def.key])}
            />
          ))}
        </div>
      </section>

      {/* Stakeholder ecosystem */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-neutral-900">{t('context.stakeholderEcosystem')}</h2>
          <span className="text-xs font-medium text-neutral-400 bg-neutral-100 rounded-full px-3 py-1">{t('context.identified', { n: stakeholders.length })}</span>
        </div>

        {stakeholders.length === 0 && (
          <p className="text-sm text-neutral-400 mb-4">{t('context.noStakeholders')}</p>
        )}

        <div className="space-y-3 mb-6">
          {stakeholders.map(s => (
            <div key={s.id} className="bg-white rounded-2xl border border-neutral-200 px-5 py-4 shadow-sm group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h5 className="text-sm font-semibold text-neutral-800">{s.name}</h5>
                  <span className={`text-[10px] font-medium border rounded-full px-2 py-0.5 ${ACTOR_COLORS[s.actor_type] ?? ACTOR_COLORS.unknown}`}>
                    {t((ACTOR_KEYS[s.actor_type] ?? 'context.unknown') as any)}
                  </span>
                  {s.role && <span className="text-xs text-neutral-400">{s.role}</span>}
                </div>
                <button
                  onClick={() => handleDeleteStakeholder(s.id)}
                  className="text-xs text-neutral-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  {t('context.remove')}
                </button>
              </div>
              {s.notes && <p className="text-sm text-neutral-600 mt-2 leading-relaxed">{s.notes}</p>}
            </div>
          ))}
        </div>

        {/* Add stakeholder */}
        <div className="bg-white rounded-2xl border-2 border-dashed border-neutral-200 p-5">
          <h3 className="text-sm font-semibold text-neutral-600 mb-3">{t('context.addStakeholder')}</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input value={newStk.name} onChange={e => setNewStk(n => ({ ...n, name: e.target.value }))} placeholder={t('context.name')}
              className={inputClass} />
            <input value={newStk.role} onChange={e => setNewStk(n => ({ ...n, role: e.target.value }))} placeholder={t('context.titleRole')}
              className={inputClass} />
          </div>
          <select value={newStk.actor_type} onChange={e => setNewStk(n => ({ ...n, actor_type: e.target.value as Stakeholder['actor_type'] }))}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 mb-3 transition-all">
            {Object.entries(ACTOR_KEYS).map(([val, key]) => <option key={val} value={val}>{t(key as any)}</option>)}
          </select>
          <textarea value={newStk.notes} onChange={e => setNewStk(n => ({ ...n, notes: e.target.value }))} rows={2}
            placeholder={t('context.notesPlaceholder')}
            className={`${inputClass} mb-3`} />
          <button onClick={handleAddStakeholder} disabled={addingStk || !newStk.name}
            className="px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 disabled:opacity-40 transition-all">
            {addingStk ? t('context.adding') : t('context.add')}
          </button>
        </div>
      </section>
    </div>
  )
}
