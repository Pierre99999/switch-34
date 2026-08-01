'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Vendor } from '@/lib/types'
import { useI18n } from '@/lib/i18n/context'
import { useRole } from '@/lib/role-context'
import { challengeLabel } from '@/lib/sales-challenges'
import AIProgress from '@/components/ui/AIProgress'
import {
  type Playbook, type PlaybookRow, type PlaybookSection, type PlaybookColumn, type PlaybookTableKey,
  emptyPlaybook, normalizePlaybook, getPlaybookSections, avoidTargetsColumn,
  sectionFilledCount, playbookProgress, exitCriterion, usageRules,
} from '@/lib/playbook'

const cellClass = "w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none placeholder:text-neutral-300 transition-all"

// ── One editable table ───────────────────────────────────────

function RowTable({
  rows, columns, addLabel, onChange, readOnly,
}: {
  rows: PlaybookRow[]
  columns: PlaybookColumn[]
  addLabel: string
  onChange: (rows: PlaybookRow[]) => void
  readOnly?: boolean
}) {
  function update(i: number, key: string, val: string) {
    onChange(rows.map((r, idx) => idx === i ? { ...r, [key]: val } : r))
  }
  function remove(i: number) { onChange(rows.filter((_, idx) => idx !== i)) }
  function add() { onChange([...rows, Object.fromEntries(columns.map(c => [c.key, '']))]) }

  return (
    <div>
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="relative bg-white border border-neutral-200 rounded-xl p-3 sm:p-4">
            {/* Stacked rather than a grid: mixing full-width and half-width
                cells left holes in the layout, and a row reads better as a
                short form than as a table on a phone. */}
            <div className="space-y-3 pr-6">
              {columns.map(c => (
                <div key={c.key}>
                  <label className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-1 block">{c.label}</label>
                  <textarea
                    value={row[c.key] ?? ''}
                    onChange={e => !readOnly && update(i, c.key, e.target.value)}
                    readOnly={readOnly}
                    rows={c.wide ? 3 : 2}
                    className={`${cellClass} ${readOnly ? 'bg-neutral-100 cursor-default' : ''}`}
                  />
                </div>
              ))}
            </div>
            {!readOnly && (
              <button
                onClick={() => remove(i)}
                aria-label="Remove row"
                className="absolute top-2 right-2 text-neutral-300 hover:text-rose-500 text-xs transition-colors px-2 py-1"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <button onClick={add} className="mt-3 text-sm font-medium text-blue-500 hover:text-blue-600 transition-colors">
          {addLabel}
        </button>
      )}
    </div>
  )
}

// ── One section (A1 … A7) ────────────────────────────────────

function SectionCard({
  section, pb, locale, onChange, onSave, saving, isDirty, readOnly,
}: {
  section: PlaybookSection
  pb: Playbook
  locale: string
  onChange: (patch: Partial<Playbook>) => void
  onSave: () => void
  saving: boolean
  isDirty: boolean
  readOnly?: boolean
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const fr = locale === 'fr'

  const total = sectionFilledCount(pb, section)

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-50/50 transition-colors text-left">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <span className="text-xs font-bold text-blue-500 flex-shrink-0">{section.code}</span>
          <span className="text-sm font-semibold text-neutral-800 truncate">{section.label}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          {isDirty && !readOnly && <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{t('profile.unsaved')}</span>}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${total > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-neutral-400 bg-neutral-100'}`}>
            {total > 0 ? (fr ? `${total} ligne${total > 1 ? 's' : ''}` : `${total} row${total > 1 ? 's' : ''}`) : (fr ? 'vide' : 'empty')}
          </span>
          <span className="text-neutral-300 text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-neutral-100 px-5 py-5">
          <div className="mb-5">
            <p className="text-sm font-medium text-blue-700 mb-2">
              {fr ? 'Ce que cette grille produit — ' : 'What this grid produces — '}{section.produces}
            </p>
            <p className="text-sm text-neutral-500 leading-relaxed">{section.intro}</p>
          </div>

          <RowTable
            rows={pb[section.key]}
            columns={section.columns}
            addLabel={section.addLabel}
            onChange={rows => onChange({ [section.key]: rows } as Partial<Playbook>)}
            readOnly={readOnly}
          />

          {section.pairedWith && (
            <div className="mt-6 pt-6 border-t border-neutral-100">
              <RowTable
                rows={pb[section.pairedWith]}
                columns={[avoidTargetsColumn(locale)]}
                addLabel={fr ? '+ Ajouter une cible à fuir' : '+ Add a target to avoid'}
                onChange={rows => onChange({ [section.pairedWith as PlaybookTableKey]: rows } as Partial<Playbook>)}
                readOnly={readOnly}
              />
            </div>
          )}

          {section.extraTextKey && (
            <div className="mt-6 pt-6 border-t border-neutral-100">
              <label className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-1 block">{section.extraTextLabel}</label>
              <textarea
                value={pb.a6_hypotheses}
                onChange={e => !readOnly && onChange({ a6_hypotheses: e.target.value })}
                readOnly={readOnly}
                rows={3}
                className={`${cellClass} ${readOnly ? 'bg-neutral-100 cursor-default' : ''}`}
              />
            </div>
          )}

          {isDirty && !readOnly && (
            <div className="mt-5 pt-4 border-t border-neutral-100">
              <button
                onClick={onSave}
                disabled={saving}
                className="px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 disabled:opacity-40 transition-all"
              >
                {saving ? t('profile.saving') : t('profile.saveChanges')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────

export default function PlaybookPage() {
  const { t, locale } = useI18n()
  const { role, loading: roleLoading } = useRole()
  const isReadOnly = role === 'sales'
  const fr = locale === 'fr'
  const SECTIONS = getPlaybookSections(locale)

  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [pb, setPb] = useState<Playbook>(emptyPlaybook(locale))
  const [savedPb, setSavedPb] = useState<Playbook>(emptyPlaybook(locale))
  const [saving, setSaving] = useState(false)

  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importKind, setImportKind] = useState<'url' | 'doc'>('url')
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (roleLoading) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = isReadOnly
      ? await supabase.from('vendors').select('*').eq('role', 'director').limit(1).maybeSingle()
      : await supabase.from('vendors').select('*').eq('user_id', user.id).maybeSingle()

    if (data) {
      setVendor(data)
      if (data.company_url) setImportUrl(u => u || data.company_url)
      const normalized = normalizePlaybook(data.playbook, locale)
      setPb(normalized)
      setSavedPb(normalized)
    }
  }, [isReadOnly, roleLoading, locale])

  useEffect(() => { load() }, [load])

  function patch(p: Partial<Playbook>) {
    setPb(prev => ({ ...prev, ...p }))
  }

  async function persist(next: Playbook) {
    if (!vendor) return
    const supabase = createClient()
    await supabase.from('vendors').update({ playbook: next }).eq('id', vendor.id)
    setSavedPb(next)
  }

  async function handleSave() {
    setSaving(true)
    await persist(pb)
    setSaving(false)
  }

  async function applyImported(imported: Playbook, source: { kind: 'url' | 'doc'; name: string }) {
    // Import overwrites A1-A4 and leaves everything the team wrote alone.
    const next: Playbook = {
      ...pb,
      source: { ...source, at: new Date().toISOString() },
      a1_value_proposition: imported.a1_value_proposition.length ? imported.a1_value_proposition : pb.a1_value_proposition,
      a2_ideal_targets: imported.a2_ideal_targets.length ? imported.a2_ideal_targets : pb.a2_ideal_targets,
      a2_avoid_targets: imported.a2_avoid_targets.length ? imported.a2_avoid_targets : pb.a2_avoid_targets,
      a3_positioning: imported.a3_positioning.length ? imported.a3_positioning : pb.a3_positioning,
      a4_perception: imported.a4_perception.length ? imported.a4_perception : pb.a4_perception,
    }
    setPb(next)
    await persist(next)
    setImportSuccess(fr ? 'Socle pré-rempli et enregistré.' : 'Socle pre-filled and saved.')
  }

  async function handleImportUrl() {
    if (!importUrl.trim()) return
    setImportKind('url')
    setImporting(true); setImportError(null); setImportSuccess(null)
    try {
      const res = await fetch('/api/playbook/from-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl.trim(), locale }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setImportError(data.error ?? 'Failed'); return }
      await applyImported(normalizePlaybook(data.playbook, locale), { kind: 'url', name: importUrl.trim() })
      if (vendor) await createClient().from('vendors').update({ company_url: importUrl.trim() }).eq('id', vendor.id)
    } catch {
      setImportError(fr ? 'Erreur réseau — réessayez' : 'Network error — try again')
    } finally {
      setImporting(false)
    }
  }

  async function handleImportDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportKind('doc')
    setImporting(true); setImportError(null); setImportSuccess(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('locale', locale)
      const res = await fetch('/api/playbook/from-doc', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok || data.error) { setImportError(data.error ?? 'Failed'); return }
      await applyImported(normalizePlaybook(data.playbook, locale), { kind: 'doc', name: file.name })
    } catch {
      setImportError(fr ? 'Erreur réseau — réessayez' : 'Network error — try again')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const { started, total } = playbookProgress(pb, locale)
  const myChallenge = challengeLabel(vendor?.sales_challenge ?? null, locale)
  const readingStep = fr
    ? (importKind === 'doc' ? 'Lecture du document' : 'Lecture de votre site')
    : (importKind === 'doc' ? 'Reading the document' : 'Reading your website')
  const importSteps = fr
    ? [readingStep, 'Segments et proposition de valeur', 'Positionnement et alternatives', 'Objections de perception']
    : [readingStep, 'Segments and value proposition', 'Positioning and alternatives', 'Perception objections']

  const sectionDirty = (s: PlaybookSection): boolean => {
    if (s.key === 'a2_ideal_targets') {
      return JSON.stringify(pb.a2_ideal_targets) !== JSON.stringify(savedPb.a2_ideal_targets)
        || JSON.stringify(pb.a2_avoid_targets) !== JSON.stringify(savedPb.a2_avoid_targets)
    }
    if (s.key === 'a6_questions') {
      return JSON.stringify(pb.a6_questions) !== JSON.stringify(savedPb.a6_questions)
        || pb.a6_hypotheses !== savedPb.a6_hypotheses
    }
    return JSON.stringify(pb[s.key]) !== JSON.stringify(savedPb[s.key])
  }

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-8 px-4 sm:px-6">
      {/* Header */}
      <div className="flex items-end justify-between mb-2 gap-4">
        <div>
          <p className="text-sm text-neutral-400 mb-1">Switch</p>
          <h1 className="text-2xl font-bold text-neutral-900">Sales Playbook</h1>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs font-medium text-neutral-400 mb-1">{t('profile.completion')}</div>
          <div className={`text-lg font-bold ${started === total ? 'text-emerald-600' : started > 0 ? 'text-blue-600' : 'text-neutral-300'}`}>
            {fr ? `${started} section${started > 1 ? 's' : ''} sur ${total}` : `${started} of ${total} sections`}
          </div>
        </div>
      </div>
      <p className="text-sm text-neutral-500 mb-8 max-w-2xl">
        {fr
          ? 'Le socle · Ce que l’entreprise sait d’elle-même — se remplit une fois, se révise lentement. Il est le même pour tous vos deals.'
          : 'The socle · What the company knows about itself — filled once, revised slowly. It is the same for every deal.'}
      </p>

      {/* Read-only banner for sales reps */}
      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-8">
          <p className="text-sm text-amber-700">{t('profile.readOnly')}</p>
        </div>
      )}

      {/* The challenge named at onboarding */}
      {!isReadOnly && myChallenge && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 mb-6">
          <div className="text-[11px] font-semibold text-blue-500 uppercase tracking-wide mb-1">
            {fr ? 'Votre enjeu' : 'Your challenge'}
          </div>
          <p className="text-sm text-blue-800">{myChallenge}</p>
        </div>
      )}

      {/* Usage rules */}
      <div className="bg-white border border-neutral-200 rounded-2xl px-5 py-4 mb-8 shadow-sm">
        <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-2">
          {fr ? 'Règles d’usage du socle' : 'How the socle is used'}
        </div>
        <ul className="space-y-1.5">
          {usageRules(locale).map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-neutral-600">
              <span className="text-neutral-300 mt-0.5">·</span>{r}
            </li>
          ))}
        </ul>
      </div>

      {/* Import panel */}
      {!isReadOnly && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 mb-8 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-700 mb-1">
            {fr ? 'Pré-remplir depuis votre site ou un document' : 'Pre-fill from your website or a document'}
          </h2>
          <p className="text-xs text-neutral-400 mb-4">
            {fr
              ? 'Switch remplit A1 à A4 — segments, cibles, positionnement, objections de perception. A5 à A7 viennent de votre histoire commerciale : ils ne s’inventent pas depuis un site.'
              : 'Switch fills A1 to A4 — segments, targets, positioning, perception objections. A5 to A7 come from your own sales history: a website cannot reveal them.'}
          </p>

          {/* Without this, an import leaves no trace and there is no way to
              tell what was analysed — or whether it ran at all. */}
          {pb.source && (
            <div className="flex items-start gap-2.5 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 mb-4">
              <span className="text-base leading-none mt-0.5">{pb.source.kind === 'doc' ? '📄' : '🌐'}</span>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">
                  {fr ? 'Dernière analyse' : 'Last analysis'}
                </div>
                <div className="text-sm text-neutral-700 break-all">{pb.source.name}</div>
                <div className="text-xs text-neutral-400 mt-0.5">
                  {new Date(pb.source.at).toLocaleString(fr ? 'fr-FR' : 'en-GB', {
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                  {' · '}
                  {pb.source.kind === 'doc' ? (fr ? 'document' : 'document') : (fr ? 'site web' : 'website')}
                </div>
              </div>
            </div>
          )}

          <div className={`flex flex-col gap-4 ${importing ? 'opacity-40 pointer-events-none' : ''}`}>
            <div>
              <div className="text-xs font-medium text-neutral-500 mb-1.5">{t('profile.websiteUrl')}</div>
              <div className="flex gap-2">
                <input
                  value={importUrl}
                  onChange={e => setImportUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleImportUrl()}
                  placeholder="yourcompany.com"
                  disabled={importing}
                  className={`flex-1 ${cellClass}`}
                />
                <button
                  onClick={handleImportUrl}
                  disabled={importing || !importUrl.trim()}
                  className="px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 disabled:opacity-40 whitespace-nowrap transition-all"
                >
                  {importing ? t('profile.reading') : t('profile.fetch')}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-neutral-100" />
              <span className="text-xs text-neutral-300">{t('profile.or')}</span>
              <div className="flex-1 h-px bg-neutral-100" />
            </div>

            <div>
              <div className="text-xs font-medium text-neutral-500 mb-1.5">{t('profile.document')} <span className="text-neutral-300">(PDF / .txt)</span></div>
              <label className={`flex items-center justify-center border-2 border-dashed border-neutral-200 bg-neutral-50 rounded-xl px-4 py-6 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all ${importing ? 'opacity-40 pointer-events-none' : ''}`}>
                <span className="text-sm text-neutral-400">{t('profile.uploadHint')}</span>
                <input type="file" accept=".pdf,.txt,.md" onChange={handleImportDoc} className="hidden" disabled={importing} />
              </label>
            </div>
          </div>

          {importing && (
            <div className="mt-5 pt-5 border-t border-neutral-100">
              <AIProgress steps={importSteps} durationSec={45} />
              <p className="text-xs text-neutral-400 mt-4 text-center">
                {fr ? 'Environ 45 secondes. Restez sur cette page.' : 'About 45 seconds. Stay on this page.'}
              </p>
            </div>
          )}
          {importError && <p className="mt-3 text-sm text-rose-600">{importError}</p>}
          {importSuccess && <p className="mt-3 text-sm text-emerald-600">{importSuccess}</p>}
        </div>
      )}

      {/* Sections A1 … A7 */}
      <div className="space-y-3">
        {SECTIONS.map(s => (
          <SectionCard
            key={s.key}
            section={s}
            pb={pb}
            locale={locale}
            onChange={patch}
            onSave={handleSave}
            saving={saving}
            isDirty={sectionDirty(s)}
            readOnly={isReadOnly}
          />
        ))}
      </div>

      {/* Exit criterion — the end of Part A */}
      <div className="mt-8 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4">
        <div className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wide mb-1">
          {fr ? 'Critère de sortie' : 'Exit criterion'}
        </div>
        <p className="text-sm text-emerald-800 leading-relaxed">{exitCriterion(locale)}</p>
      </div>
    </div>
  )
}
