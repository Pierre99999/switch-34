'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Vendor, type VendorDimensions, EMPTY_VENDOR_DIMENSIONS } from '@/lib/types'
import { useI18n } from '@/lib/i18n/context'
import { useRole } from '@/lib/role-context'
import { getDimensions, type DimensionDef } from '@/lib/i18n/profile-dimensions'

// ── Helpers ──────────────────────────────────────────────────

const inputClass = "w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none placeholder:text-neutral-300 transition-all"

function filledCount(dim: Record<string, string>): number {
  return Object.values(dim).filter(v => v.trim().length > 0).length
}

function deepMerge(base: VendorDimensions, saved: Partial<VendorDimensions>): VendorDimensions {
  const result = { ...base }
  for (const key of Object.keys(saved) as (keyof VendorDimensions)[]) {
    if (saved[key]) result[key] = { ...base[key], ...saved[key] } as never
  }
  return result
}

// ── Dimension section ────────────────────────────────────────

function DimensionSection({
  def,
  values,
  onChange,
  onSave,
  saving,
  isDirty,
  readOnly,
}: {
  def: DimensionDef
  values: Record<string, string>
  onChange: (key: string, val: string) => void
  onSave: () => void
  saving: boolean
  isDirty: boolean
  readOnly?: boolean
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const total = def.questions.length
  const filled = filledCount(values)

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-neutral-800">{def.label}</span>
          <span className="text-xs text-neutral-400 hidden sm:block max-w-sm truncate">{def.description}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          {isDirty && !readOnly && <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{t('profile.unsaved')}</span>}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${filled === total ? 'text-emerald-600 bg-emerald-50' : filled > 0 ? 'text-amber-600 bg-amber-50' : 'text-neutral-400 bg-neutral-100'}`}>
            {filled}/{total}
          </span>
          <span className="text-neutral-300 text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-neutral-100 px-5 py-5">
          <p className="text-xs text-neutral-500 leading-relaxed mb-6 bg-neutral-50 rounded-xl px-4 py-3">{def.description}</p>
          <div className="space-y-5">
            {def.questions.map(q => (
              <div key={q.key}>
                <label className="text-sm font-medium text-neutral-700">{q.label}</label>
                <p className="text-xs text-neutral-400 mt-0.5 mb-2">{q.hint}</p>
                <textarea
                  value={values[q.key] ?? ''}
                  onChange={e => !readOnly && onChange(q.key, e.target.value)}
                  readOnly={readOnly}
                  rows={3}
                  placeholder="..."
                  className={`${inputClass} ${readOnly ? 'bg-neutral-100 cursor-default' : ''}`}
                />
              </div>
            ))}
          </div>
          {isDirty && !readOnly && (
            <div className="mt-5 flex items-center gap-3 pt-4 border-t border-neutral-100">
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

export default function ProfilePage() {
  const { t, locale } = useI18n()
  const { role } = useRole()
  const isReadOnly = role === 'sales'
  const DIMENSIONS = getDimensions(locale)
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [dims, setDims] = useState<VendorDimensions>(EMPTY_VENDOR_DIMENSIONS)
  const [savedDims, setSavedDims] = useState<VendorDimensions>(EMPTY_VENDOR_DIMENSIONS)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let vendorData
    if (isReadOnly) {
      const { data } = await supabase.from('vendors').select('*').eq('role', 'director').limit(1).single()
      vendorData = data
    } else {
      const { data } = await supabase.from('vendors').select('*').eq('user_id', user.id).single()
      vendorData = data
    }

    if (vendorData) {
      setVendor(vendorData)
      const merged = deepMerge(EMPTY_VENDOR_DIMENSIONS, vendorData.dimensions ?? {})
      setDims(merged)
      setSavedDims(merged)
    }
  }, [isReadOnly])

  useEffect(() => { load() }, [load])

  function handleChange(dimKey: keyof VendorDimensions, subKey: string, val: string) {
    setDims(d => ({ ...d, [dimKey]: { ...d[dimKey], [subKey]: val } }))
  }

  async function handleSave(dimKey: keyof VendorDimensions) {
    if (!vendor) return
    setSavingKey(dimKey)
    const supabase = createClient()
    const merged = { ...(vendor.dimensions ?? {}), [dimKey]: dims[dimKey] }
    await supabase.from('vendors').update({ dimensions: merged }).eq('id', vendor.id)
    setSavedDims(d => ({ ...d, [dimKey]: dims[dimKey] }))
    await load()
    setSavingKey(null)
  }

  async function saveAllDims(newDims: VendorDimensions, currentVendor: Vendor) {
    const supabase = createClient()
    await supabase.from('vendors').update({ dimensions: newDims }).eq('id', currentVendor.id)
    setSavedDims(newDims)
  }

  async function applyExtracted(extracted: Partial<VendorDimensions>) {
    const newDims = deepMerge(dims, extracted)
    setDims(newDims)
    if (vendor) {
      await saveAllDims(newDims, vendor)
      setImportSuccess('Profile imported and saved.')
    } else {
      setImportSuccess('Profile pre-filled. Save each dimension to persist.')
    }
  }

  async function handleImportUrl() {
    if (!importUrl.trim()) return
    setImporting(true)
    setImportError(null)
    setImportSuccess(null)
    try {
      const res = await fetch('/api/profile/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl.trim(), locale }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setImportError(data.error ?? 'Failed'); return }
      await applyExtracted(data.dimensions)
    } catch {
      setImportError('Network error — try again')
    } finally {
      setImporting(false)
    }
  }

  async function handleImportDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportError(null)
    setImportSuccess(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('locale', locale)
      const res = await fetch('/api/profile/from-doc', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok || data.error) { setImportError(data.error ?? 'Failed'); return }
      await applyExtracted(data.dimensions)
    } catch {
      setImportError('Network error — try again')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const totalFilled = DIMENSIONS.reduce((acc, d) => acc + filledCount(dims[d.key] as Record<string, string>), 0)
  const totalQuestions = DIMENSIONS.reduce((acc, d) => acc + d.questions.length, 0)

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-sm text-neutral-400 mb-1">Switch</p>
          <h1 className="text-2xl font-bold text-neutral-900">{t('profile.title')}</h1>
        </div>
        <div className="text-right">
          <div className="text-xs font-medium text-neutral-400 mb-1">{t('profile.completion')}</div>
          <div className={`text-lg font-bold ${totalFilled === totalQuestions ? 'text-emerald-600' : totalFilled > 0 ? 'text-amber-600' : 'text-neutral-300'}`}>
            {totalFilled}/{totalQuestions}
          </div>
        </div>
      </div>

      {/* Read-only banner for sales reps */}
      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-8">
          <p className="text-sm text-amber-700">{t('profile.readOnly')}</p>
        </div>
      )}

      {/* Import panel */}
      {!isReadOnly && <div className="bg-white rounded-2xl border border-neutral-200 p-6 mb-8 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-700 mb-4">{t('profile.importFrom')}</h2>
        <div className="flex flex-col gap-4">
          {/* URL */}
          <div>
            <div className="text-xs font-medium text-neutral-500 mb-1.5">{t('profile.websiteUrl')}</div>
            <div className="flex gap-2">
              <input
                value={importUrl}
                onChange={e => setImportUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleImportUrl()}
                placeholder="yourcompany.com"
                disabled={importing}
                className={`flex-1 ${inputClass}`}
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

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-neutral-100" />
            <span className="text-xs text-neutral-300">{t('profile.or')}</span>
            <div className="flex-1 h-px bg-neutral-100" />
          </div>

          {/* Document */}
          <div>
            <div className="text-xs font-medium text-neutral-500 mb-1.5">{t('profile.document')} <span className="text-neutral-300">(PDF / .txt)</span></div>
            <label className={`flex items-center justify-center border-2 border-dashed border-neutral-200 bg-neutral-50 rounded-xl px-4 py-6 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all ${importing ? 'opacity-40 pointer-events-none' : ''}`}>
              <span className="text-sm text-neutral-400">
                {importing ? t('profile.readingDoc') : t('profile.uploadHint')}
              </span>
              <input type="file" accept=".pdf,.txt,.md" onChange={handleImportDoc} className="hidden" disabled={importing} />
            </label>
          </div>
        </div>

        {importError && <p className="mt-3 text-sm text-rose-600">{importError}</p>}
        {importSuccess && <p className="mt-3 text-sm text-emerald-600">{importSuccess}</p>}
      </div>}

      {/* Info card */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 mb-8">
        <p className="text-sm text-blue-700">
          {t('profile.infoCard')}
        </p>
      </div>

      {/* Dimension sections */}
      <div className="space-y-3">
        {DIMENSIONS.map(def => (
          <DimensionSection
            key={def.key}
            def={def}
            values={dims[def.key] as Record<string, string>}
            onChange={(subKey, val) => handleChange(def.key, subKey, val)}
            onSave={() => handleSave(def.key)}
            saving={savingKey === def.key}
            isDirty={JSON.stringify(dims[def.key]) !== JSON.stringify(savedDims[def.key])}
            readOnly={isReadOnly}
          />
        ))}
      </div>
    </div>
  )
}
