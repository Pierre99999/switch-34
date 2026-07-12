'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'

const inputClass = "mt-1 w-full border border-stone-300 bg-white px-3 py-2.5 text-sm font-mono text-stone-900 focus:outline-none focus:border-stone-900"
const btnPrimary = "w-full bg-stone-900 text-stone-50 py-3 text-xs uppercase tracking-widest font-mono hover:bg-stone-800 disabled:opacity-40"
const btnSecondary = "w-full border border-stone-300 text-stone-600 py-3 text-xs uppercase tracking-widest font-mono hover:border-stone-600 disabled:opacity-40"

export default function OnboardingPage() {
  const router = useRouter()
  const { t, locale, setLocale } = useI18n()

  // Step 0: role + name + language
  const [step, setStep] = useState(0)
  const [role, setRole] = useState<'sales' | 'director'>('director')
  const [selectedLocale, setSelectedLocale] = useState<'fr' | 'en'>(locale as 'fr' | 'en')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyUrl, setCompanyUrl] = useState('')

  // Sales: invite code
  const [inviteCode, setInviteCode] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)

  // Director step 2: profile import
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  // Director step 3: mandatory questions
  const [questions, setQuestions] = useState<string[]>([''])

  // Director step 4: invite code display
  const [orgInviteCode, setOrgInviteCode] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Step 0: Create account (both roles) ──
  async function handleStep0() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    if (role === 'sales') {
      // Validate invite code
      setInviteError(null)
      if (!inviteCode.trim()) { setInviteError(t('onboarding.invalidCode')); setLoading(false); return }
      const { data: org } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('invite_code', inviteCode.trim())
        .single()
      if (!org) { setInviteError(t('onboarding.invalidCode')); setLoading(false); return }

      setLocale(selectedLocale)
      const { error } = await supabase.from('vendors').insert({
        user_id: user.id,
        company_name: org.name,
        full_name: fullName || null,
        locale: selectedLocale,
        role: 'sales',
        organization_id: org.id,
        onboarding_completed: true,
      })
      if (error) { setError(error.message); setLoading(false); return }
      router.push('/pipeline')
      router.refresh()
      return
    }

    // Director: create org + vendor
    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .insert({ name: companyName, owner_id: user.id })
      .select()
      .single()
    if (orgErr || !org) { setError(orgErr?.message ?? 'Failed to create organization'); setLoading(false); return }

    setLocale(selectedLocale)
    const { error: vendorErr } = await supabase.from('vendors').insert({
      user_id: user.id,
      company_name: companyName,
      full_name: fullName || null,
      locale: selectedLocale,
      role: 'director',
      organization_id: org.id,
      onboarding_completed: false,
    })
    if (vendorErr) { setError(vendorErr.message); setLoading(false); return }

    setOrgInviteCode(org.invite_code)
    setLoading(false)
    setStep(1)
  }

  // ── Step 1: Import profile from URL ──
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
      if (!res.ok || data.error) { setImportError(data.error ?? 'Failed'); setImporting(false); return }

      // Save dimensions to vendor
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('vendors').update({ dimensions: data.dimensions }).eq('user_id', user.id)
      }
      setImportSuccess(t('onboarding.profileImported'))
    } catch {
      setImportError('Network error')
    }
    setImporting(false)
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
      if (!res.ok || data.error) { setImportError(data.error ?? 'Failed'); setImporting(false); return }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('vendors').update({ dimensions: data.dimensions }).eq('user_id', user.id)
      }
      setImportSuccess(t('onboarding.profileImported'))
    } catch {
      setImportError('Network error')
    }
    setImporting(false)
    e.target.value = ''
  }

  // ── Step 2: Save mandatory questions ──
  async function handleSaveQuestions() {
    const filtered = questions.filter(q => q.trim())
    if (filtered.length === 0) return
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: vendor } = await supabase.from('vendors').select('organization_id').eq('user_id', user.id).single()
    if (!vendor?.organization_id) { setLoading(false); return }

    for (const text of filtered) {
      await supabase.from('question_templates').insert({
        organization_id: vendor.organization_id,
        text,
        created_by: user.id,
      })
    }
    setLoading(false)
    setStep(3)
  }

  // ── Step 3: Finish ──
  async function handleFinish() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('vendors').update({ onboarding_completed: true }).eq('user_id', user.id)
    }
    router.push('/profile')
    router.refresh()
  }

  function copyInviteCode() {
    navigator.clipboard.writeText(orgInviteCode)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  // ── Render ──
  const totalSteps = role === 'director' ? 4 : 1

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto py-20 px-6">
        <div className="mb-10">
          <div className="text-xs uppercase tracking-widest text-stone-500 font-mono mb-2">Switch · setup</div>
          <h1 className="font-serif text-3xl text-stone-900 italic">{t('onboarding.title')}</h1>
          {step > 0 && (
            <div className="flex gap-1 mt-4">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-stone-900' : 'bg-stone-200'}`} />
              ))}
            </div>
          )}
        </div>

        {/* ── Step 0: Role + Name ── */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono mb-2 block">{t('onboarding.language')}</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedLocale('fr')}
                  className={`border px-4 py-3 text-center transition-all ${selectedLocale === 'fr' ? 'border-stone-900 bg-stone-50' : 'border-stone-200 hover:border-stone-400'}`}
                >
                  <div className="text-sm font-medium text-stone-900 font-mono">Français</div>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLocale('en')}
                  className={`border px-4 py-3 text-center transition-all ${selectedLocale === 'en' ? 'border-stone-900 bg-stone-50' : 'border-stone-200 hover:border-stone-400'}`}
                >
                  <div className="text-sm font-medium text-stone-900 font-mono">English</div>
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono mb-2 block">{t('onboarding.yourRole')}</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('director')}
                  className={`border px-4 py-3 text-left transition-all ${role === 'director' ? 'border-stone-900 bg-stone-50' : 'border-stone-200 hover:border-stone-400'}`}
                >
                  <div className="text-sm font-medium text-stone-900 font-mono">{t('onboarding.roleDirector')}</div>
                  <div className="text-xs text-stone-500 mt-0.5">{t('onboarding.roleDirectorDesc')}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('sales')}
                  className={`border px-4 py-3 text-left transition-all ${role === 'sales' ? 'border-stone-900 bg-stone-50' : 'border-stone-200 hover:border-stone-400'}`}
                >
                  <div className="text-sm font-medium text-stone-900 font-mono">{t('onboarding.roleSales')}</div>
                  <div className="text-xs text-stone-500 mt-0.5">{t('onboarding.roleSalesDesc')}</div>
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">{t('onboarding.fullName')}</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder={t('onboarding.fullNamePlaceholder')} className={inputClass} />
            </div>

            {role === 'director' && (
              <div>
                <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">{t('onboarding.companyName')}</label>
                <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder={t('onboarding.companyNamePlaceholder')} required className={inputClass} />
              </div>
            )}

            {role === 'sales' && (
              <div>
                <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">{t('onboarding.inviteCode')}</label>
                <input type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder={t('onboarding.inviteCodePlaceholder')} className={inputClass} />
                <p className="text-xs text-stone-400 mt-1 font-mono">{t('onboarding.inviteCodeHint')}</p>
                {inviteError && <p className="text-xs text-rose-700 font-mono mt-1">{inviteError}</p>}
              </div>
            )}

            {error && <p className="text-xs text-rose-700 font-mono">{error}</p>}

            <button
              onClick={handleStep0}
              disabled={loading || (role === 'director' && !companyName.trim()) || (role === 'sales' && !inviteCode.trim())}
              className={btnPrimary}
            >
              {loading ? t('onboarding.saving') : role === 'director' ? t('onboarding.next') : t('onboarding.submit')}
            </button>
          </div>
        )}

        {/* ── Step 1 (Director): Import company profile ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-stone-900 font-mono">{t('onboarding.profileStep')}</h2>
              <p className="text-sm text-stone-500 mt-1">{t('onboarding.profileStepDesc')}</p>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">{t('onboarding.website')}</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="text" value={importUrl} onChange={e => setImportUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleImportUrl()}
                  placeholder="yourcompany.com" disabled={importing}
                  className="flex-1 border border-stone-300 bg-white px-3 py-2.5 text-sm font-mono text-stone-900 focus:outline-none focus:border-stone-900"
                />
                <button onClick={handleImportUrl} disabled={importing || !importUrl.trim()} className="px-4 py-2.5 bg-stone-900 text-stone-50 text-xs font-mono uppercase tracking-widest hover:bg-stone-800 disabled:opacity-40">
                  {importing ? '…' : t('profile.fetch')}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-stone-200" />
              <span className="text-xs text-stone-300 font-mono">{t('profile.or')}</span>
              <div className="flex-1 h-px bg-stone-200" />
            </div>

            <div>
              <label className={`flex items-center justify-center border-2 border-dashed border-stone-200 bg-stone-50 px-4 py-8 cursor-pointer hover:border-stone-400 transition-all ${importing ? 'opacity-40 pointer-events-none' : ''}`}>
                <span className="text-sm text-stone-400 font-mono">
                  {importing ? t('onboarding.importingProfile') : t('profile.uploadHint')}
                </span>
                <input type="file" accept=".pdf,.txt,.md" onChange={handleImportDoc} className="hidden" disabled={importing} />
              </label>
            </div>

            {importError && <p className="text-xs text-rose-700 font-mono">{importError}</p>}
            {importSuccess && <p className="text-xs text-emerald-700 font-mono">{importSuccess}</p>}

            <div className="flex gap-3 pt-4">
              <button onClick={() => setStep(2)} className={btnSecondary}>
                {importSuccess ? t('onboarding.next') : t('onboarding.skipForNow')}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2 (Director): Mandatory questions ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-stone-900 font-mono">{t('onboarding.questionsStep')}</h2>
              <p className="text-sm text-stone-500 mt-1">{t('onboarding.questionsStepDesc')}</p>
            </div>

            <div className="space-y-2">
              {questions.map((q, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="text-xs text-stone-400 font-mono w-5 text-right flex-shrink-0">{i + 1}.</span>
                  <input
                    value={q}
                    onChange={e => setQuestions(qs => qs.map((item, idx) => idx === i ? e.target.value : item))}
                    placeholder={t('onboarding.questionPlaceholder')}
                    className="flex-1 border border-stone-300 bg-white px-3 py-2 text-sm font-mono text-stone-900 focus:outline-none focus:border-stone-900"
                  />
                  {questions.length > 1 && (
                    <button onClick={() => setQuestions(qs => qs.filter((_, idx) => idx !== i))} className="text-stone-300 hover:text-rose-500 transition-colors">✕</button>
                  )}
                </div>
              ))}
              <button onClick={() => setQuestions(qs => [...qs, ''])} className="text-sm font-medium text-stone-500 hover:text-stone-900 font-mono transition-colors">
                {t('onboarding.addQuestion')}
              </button>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setStep(1)} className={btnSecondary}>{t('onboarding.back')}</button>
              <button
                onClick={questions.some(q => q.trim()) ? handleSaveQuestions : () => setStep(3)}
                disabled={loading}
                className={btnPrimary}
              >
                {loading ? '…' : questions.some(q => q.trim()) ? t('onboarding.next') : t('onboarding.skipForNow')}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3 (Director): Team invite code ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-stone-900 font-mono">{t('onboarding.teamStep')}</h2>
              <p className="text-sm text-stone-500 mt-1">{t('onboarding.teamStepDesc')}</p>
            </div>

            <div className="bg-stone-50 border border-stone-200 p-6 text-center">
              <div className="text-3xl font-mono font-bold text-stone-900 tracking-widest mb-3">
                {orgInviteCode}
              </div>
              <button onClick={copyInviteCode} className="text-xs font-mono text-stone-500 hover:text-stone-900 underline transition-colors">
                {codeCopied ? t('onboarding.codeCopied') : t('onboarding.copyCode')}
              </button>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setStep(2)} className={btnSecondary}>{t('onboarding.back')}</button>
              <button onClick={handleFinish} disabled={loading} className={btnPrimary}>
                {loading ? '…' : t('onboarding.finish')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
