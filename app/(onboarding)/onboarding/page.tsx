'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { useRole } from '@/lib/role-context'
import { SALES_CHALLENGES } from '@/lib/sales-challenges'
import AIProgress from '@/components/ui/AIProgress'

const inputClass = "mt-1 w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder:text-neutral-300 transition-all"
const btnPrimary = "w-full bg-blue-500 text-white py-3 text-sm font-semibold rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 disabled:opacity-40 transition-all"
const btnSecondary = "w-full bg-white border border-neutral-200 text-neutral-600 py-3 text-sm font-medium rounded-xl hover:border-neutral-400 disabled:opacity-40 transition-all"

export default function OnboardingPage() {
  const router = useRouter()
  const { t, locale, setLocale } = useI18n()
  const { refresh: refreshRole } = useRole()

  // Step 0: the challenge. Step 1: role + name + language.
  const [step, setStep] = useState(0)
  const [challenge, setChallenge] = useState<string | null>(null)
  const [challengeNote, setChallengeNote] = useState('')
  const [role, setRole] = useState<'sales' | 'director'>('director')
  const [selectedLocale, setSelectedLocale] = useState<'fr' | 'en'>(locale as 'fr' | 'en')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')

  // Sales: invite code
  const [inviteCode, setInviteCode] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)

  // Director step 2: profile import
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  // Which import produced the notice — the first line names the source.
  const [showImportNotice, setShowImportNotice] = useState<'url' | 'doc' | null>(null)
  const [importKind, setImportKind] = useState<'url' | 'doc'>('url')

  // Director step 2: invite code display
  const [orgInviteCode, setOrgInviteCode] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Step 1: Create account (both roles) ──
  async function handleAccountStep() {
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
        sales_challenge: challenge,
        sales_challenge_note: challengeNote.trim() || null,
      })
      if (error) { setError(error.message); setLoading(false); return }
      await refreshRole()
      router.push('/lab')
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
      sales_challenge: challenge,
      sales_challenge_note: challengeNote.trim() || null,
    })
    if (vendorErr) { setError(vendorErr.message); setLoading(false); return }

    setOrgInviteCode(org.invite_code)
    setLoading(false)
    setStep(2)
  }

  // ── Step 2: Import profile from URL ──
  async function handleImportUrl() {
    if (!importUrl.trim()) return
    setImportKind('url')
    setImporting(true)
    setImportError(null)
    setImportSuccess(null)
    try {
      const res = await fetch('/api/playbook/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl.trim(), locale }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setImportError(data.error ?? 'Failed'); setImporting(false); return }

      // Save the playbook socle. The URL is stored too so the playbook page
      // can show it back instead of asking for it a second time.
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('vendors').update({
          playbook: { ...data.playbook, source: { kind: 'url', name: importUrl.trim(), at: new Date().toISOString() } },
          company_url: importUrl.trim(),
        }).eq('user_id', user.id)
      }
      setImportSuccess(t('onboarding.profileImported'))
      setShowImportNotice('url')
    } catch {
      setImportError('Network error')
    }
    setImporting(false)
  }

  async function handleImportDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportKind('doc')
    setImporting(true)
    setImportError(null)
    setImportSuccess(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('locale', locale)
      const res = await fetch('/api/playbook/from-doc', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok || data.error) { setImportError(data.error ?? 'Failed'); setImporting(false); return }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('vendors').update({
          playbook: { ...data.playbook, source: { kind: 'doc', name: file.name, at: new Date().toISOString() } },
        }).eq('user_id', user.id)
      }
      setImportSuccess(t('onboarding.profileImported'))
      setShowImportNotice('doc')
    } catch {
      setImportError('Network error')
    }
    setImporting(false)
    e.target.value = ''
  }

  // ── Step 2: Finish ──
  async function handleFinish() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('vendors').update({ onboarding_completed: true }).eq('user_id', user.id)
    }
    await refreshRole()
    router.push('/playbook')
    router.refresh()
  }

  function copyInviteCode() {
    navigator.clipboard.writeText(orgInviteCode)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  // ── Render ──
  const fr = selectedLocale === 'fr'
  const readingStep = fr
    ? (importKind === 'doc' ? 'Lecture du document' : 'Lecture de votre site')
    : (importKind === 'doc' ? 'Reading the document' : 'Reading your website')
  const importSteps = fr
    ? [readingStep, 'Cibles et proposition de valeur', 'Positionnement et alternatives', 'Objections de perception']
    : [readingStep, 'Targets and value proposition', 'Positioning and alternatives', 'Perception objections']
  const totalSteps = role === 'director' ? 4 : 2
  const selectedChallenge = SALES_CHALLENGES.find(c => c.key === challenge) ?? null

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Shown once the site analysis lands: sets expectations about the gaps
          before the user sees them and reads them as a failed import. */}
      {showImportNotice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 backdrop-blur-sm px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-notice-title"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-neutral-200 p-6 sm:p-7">
            <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
              <span className="text-xl">✓</span>
            </div>
            <h2 id="import-notice-title" className="text-lg font-semibold text-neutral-900 mb-3">
              {fr ? 'Socle pré-rempli' : 'Socle pre-filled'}
            </h2>
            <div className="space-y-3 text-sm text-neutral-600 leading-relaxed">
              <p>
                {fr
                  ? `Nous avons analysé ${showImportNotice === 'doc' ? 'votre document' : 'votre site web'}. Certaines sections peuvent être incomplètes, car elles ne sont pas toujours visibles publiquement. A5 à A7 viennent de votre histoire commerciale : elles restent à remplir.`
                  : `We analyzed ${showImportNotice === 'doc' ? 'your document' : 'your website'}. Some sections may be incomplete, as they are not always publicly visible. A5 to A7 come from your own sales history and are still yours to fill in.`}
              </p>
              <p>
                {fr
                  ? 'Ce n’est pas bloquant. Plus votre contexte est complet, plus nos analyses et nos recommandations seront pertinentes.'
                  : 'This is not blocking. The more complete your context, the more relevant our analyses and recommendations will be.'}
              </p>
              <p>
                {fr
                  ? 'Vous pourrez compléter votre playbook à tout moment.'
                  : 'You can complete your playbook at any time.'}
              </p>
            </div>
            <button onClick={() => setShowImportNotice(null)} className={`${btnPrimary} mt-6`} autoFocus>
              {fr ? 'Continuer' : 'Continue'}
            </button>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto py-14 sm:py-20 px-4 sm:px-6">
        <div className="mb-10">
          <div className="text-2xl font-bold text-blue-500 tracking-tight mb-3">Switch</div>
          <h1 className="text-2xl font-bold text-neutral-900">
            {step === 0
              ? (fr ? 'Commençons par vous.' : 'Let us start with you.')
              : t('onboarding.title')}
          </h1>
          <div className="flex gap-1 mt-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-blue-500' : 'bg-neutral-200'}`} />
            ))}
          </div>
        </div>

        {/* ── Step 0: What hurts right now ── */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2 block">{t('onboarding.language')}</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedLocale('fr')}
                  className={`border rounded-xl px-4 py-3 text-center transition-all ${selectedLocale === 'fr' ? 'border-blue-500 bg-blue-50' : 'border-neutral-200 bg-white hover:border-neutral-400'}`}
                >
                  <div className="text-sm font-semibold text-neutral-800">Français</div>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLocale('en')}
                  className={`border rounded-xl px-4 py-3 text-center transition-all ${selectedLocale === 'en' ? 'border-blue-500 bg-blue-50' : 'border-neutral-200 bg-white hover:border-neutral-400'}`}
                >
                  <div className="text-sm font-semibold text-neutral-800">English</div>
                </button>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-neutral-900">
                {fr
                  ? 'Quelle est votre principale difficulté en ce moment sur la conversion ?'
                  : 'What is your main conversion problem right now?'}
              </h2>
              <p className="text-sm text-neutral-500 mt-1">
                {fr
                  ? "Switch part de là. Tout ce que vous renseignerez ensuite sert à résoudre ce point précis."
                  : 'Switch starts from here. Everything you fill in afterwards serves this one problem.'}
              </p>
            </div>

            <div className="space-y-2.5">
              {SALES_CHALLENGES.map(c => {
                const active = challenge === c.key
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setChallenge(active ? null : c.key)}
                    className={`w-full border rounded-xl px-4 py-3.5 text-left transition-all ${active ? 'border-blue-500 bg-blue-50' : 'border-neutral-200 bg-white hover:border-neutral-400'}`}
                  >
                    <div className="text-sm font-medium text-neutral-800">{c.label[fr ? 'fr' : 'en']}</div>
                    {active && (
                      <div className="text-xs text-blue-700 mt-1.5 leading-relaxed">
                        {fr ? '→ ' : '→ '}{c.answer[fr ? 'fr' : 'en']}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                {fr ? 'Autre chose ? (facultatif)' : 'Anything else? (optional)'}
              </label>
              <textarea
                value={challengeNote}
                onChange={e => setChallengeNote(e.target.value)}
                rows={3}
                placeholder={fr
                  ? 'Ex. : on ne distingue pas un prospect preneur d’infos d’un prospect qui va vraiment acheter.'
                  : 'E.g. we cannot tell an info-gatherer from a prospect who will actually buy.'}
                className={`${inputClass} resize-none`}
              />
            </div>

            <button onClick={() => setStep(1)} disabled={!challenge && !challengeNote.trim()} className={btnPrimary}>
              {fr ? 'Continuer' : 'Continue'}
            </button>
            <button onClick={() => setStep(1)} className="w-full text-sm text-neutral-400 hover:text-neutral-600 transition-colors">
              {fr ? 'Passer' : 'Skip'}
            </button>
          </div>
        )}

        {/* ── Step 1: Role + Name ── */}
        {step === 1 && (
          <div className="space-y-5">
            {selectedChallenge && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <div className="text-[11px] font-semibold text-blue-500 uppercase tracking-wide mb-0.5">
                  {fr ? 'Votre enjeu' : 'Your challenge'}
                </div>
                <div className="text-sm text-blue-800">{selectedChallenge.label[fr ? 'fr' : 'en']}</div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2 block">{t('onboarding.yourRole')}</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('director')}
                  className={`border rounded-xl px-4 py-3 text-left transition-all ${role === 'director' ? 'border-blue-500 bg-blue-50' : 'border-neutral-200 bg-white hover:border-neutral-400'}`}
                >
                  <div className="text-sm font-semibold text-neutral-800">{t('onboarding.roleDirector')}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">{t('onboarding.roleDirectorDesc')}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('sales')}
                  className={`border rounded-xl px-4 py-3 text-left transition-all ${role === 'sales' ? 'border-blue-500 bg-blue-50' : 'border-neutral-200 bg-white hover:border-neutral-400'}`}
                >
                  <div className="text-sm font-semibold text-neutral-800">{t('onboarding.roleSales')}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">{t('onboarding.roleSalesDesc')}</div>
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{t('onboarding.fullName')}</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder={t('onboarding.fullNamePlaceholder')} className={inputClass} />
            </div>

            {role === 'director' && (
              <div>
                <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{t('onboarding.companyName')}</label>
                <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder={t('onboarding.companyNamePlaceholder')} required className={inputClass} />
              </div>
            )}

            {role === 'sales' && (
              <div>
                <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{t('onboarding.inviteCode')}</label>
                <input type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder={t('onboarding.inviteCodePlaceholder')} className={inputClass} />
                <p className="text-xs text-neutral-400 mt-1">{t('onboarding.inviteCodeHint')}</p>
                {inviteError && <p className="text-sm text-rose-600 mt-1">{inviteError}</p>}
              </div>
            )}

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <button
              onClick={handleAccountStep}
              disabled={loading || (role === 'director' && !companyName.trim()) || (role === 'sales' && !inviteCode.trim())}
              className={btnPrimary}
            >
              {loading ? t('onboarding.saving') : role === 'director' ? t('onboarding.next') : t('onboarding.submit')}
            </button>
            <button onClick={() => setStep(0)} className="w-full text-sm text-neutral-400 hover:text-neutral-600 transition-colors">
              {t('onboarding.back')}
            </button>
          </div>
        )}

        {/* ── Step 2 (Director): Import company profile ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">{t('onboarding.profileStep')}</h2>
              <p className="text-sm text-neutral-500 mt-1">{t('onboarding.profileStepDesc')}</p>
            </div>

            <div className={importing ? 'opacity-40 pointer-events-none' : ''}>
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{t('onboarding.website')}</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="text" value={importUrl} onChange={e => setImportUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleImportUrl()}
                  placeholder="yourcompany.com" disabled={importing}
                  className="flex-1 bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                />
                <button onClick={handleImportUrl} disabled={importing || !importUrl.trim()} className="px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 disabled:opacity-40 transition-all">
                  {importing ? '…' : t('profile.fetch')}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-neutral-200" />
              <span className="text-xs text-neutral-300">{t('profile.or')}</span>
              <div className="flex-1 h-px bg-neutral-200" />
            </div>

            <div>
              <label className={`flex items-center justify-center border-2 border-dashed border-neutral-200 bg-white rounded-2xl px-4 py-8 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all ${importing ? 'opacity-40 pointer-events-none' : ''}`}>
                <span className="text-sm text-neutral-400">
                  {importing ? t('onboarding.importingProfile') : t('profile.uploadHint')}
                </span>
                <input type="file" accept=".pdf,.txt,.md" onChange={handleImportDoc} className="hidden" disabled={importing} />
              </label>
            </div>

            {importing && (
              <div className="bg-white border border-neutral-200 rounded-2xl p-5">
                <AIProgress steps={importSteps} durationSec={45} />
                <p className="text-xs text-neutral-400 mt-4 text-center">
                  {fr ? 'Environ 45 secondes. Vous pouvez laisser cet écran ouvert.' : 'About 45 seconds. You can leave this screen open.'}
                </p>
              </div>
            )}

            {importError && <p className="text-sm text-rose-600">{importError}</p>}
            {importSuccess && <p className="text-sm text-emerald-600">{importSuccess}</p>}

            <div className="flex gap-3 pt-4">
              <button onClick={() => setStep(3)} disabled={importing} className={btnSecondary}>
                {importSuccess ? t('onboarding.next') : t('onboarding.skipForNow')}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3 (Director): Team invite code ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">{t('onboarding.teamStep')}</h2>
              <p className="text-sm text-neutral-500 mt-1">{t('onboarding.teamStepDesc')}</p>
            </div>

            <div className="bg-white border border-neutral-200 rounded-2xl p-6 text-center shadow-sm">
              <div className="text-3xl font-mono font-bold text-neutral-900 tracking-widest mb-3">
                {orgInviteCode}
              </div>
              <button onClick={copyInviteCode} className="text-sm font-medium text-blue-500 hover:text-blue-600 transition-colors">
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
