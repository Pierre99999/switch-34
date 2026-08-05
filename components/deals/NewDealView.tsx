'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import AIProgress from '@/components/ui/AIProgress'

const inputClass = "mt-1 w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder:text-neutral-300 transition-all"
const btnPrimary = "flex-1 bg-blue-500 text-white py-2.5 text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 disabled:opacity-40 transition-all"
const btnSecondary = "px-6 py-2.5 text-sm font-medium rounded-xl text-neutral-600 bg-white border border-neutral-200 hover:border-neutral-400 transition-all"

type ActorType = 'champion' | 'decision_maker' | 'user' | 'reviewer' | 'budget_guardian' | 'blocker' | 'unknown'
type Contact = { name: string; title: string; linkedin: string; actor_types: ActorType[] }

// Selectable roles (unknown is the implicit default when none is chosen).
const ACTOR_KEYS: { value: ActorType; key: string }[] = [
  { value: 'decision_maker', key: 'context.decisionMaker' },
  { value: 'champion', key: 'context.champion' },
  { value: 'reviewer', key: 'context.reviewer' },
  { value: 'budget_guardian', key: 'context.budgetGuardian' },
  { value: 'user', key: 'context.endUser' },
  { value: 'blocker', key: 'context.blocker' },
]

// Shared by the live app and the lab. The only difference is where a freshly
// created deal opens: the multi-screen context page, or the lab's one screen.
export default function NewDealView({
  createdHref = (id: string) => `/deals/${id}/context`,
  contextLocation,
}: {
  createdHref?: (id: string) => string
  /** Where the analysis will be found afterwards. Differs between the two
   *  interfaces, and telling the seller the wrong place is worse than saying
   *  nothing. */
  contextLocation?: string
} = {}) {
  const router = useRouter()
  const { t, locale } = useI18n()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 0: who the prospect is, and the material to analyse.
  // What to look for no longer needs asking — the Sales Playbook says it.
  const [prospectName, setProspectName] = useState('')
  const [prospectUrl, setProspectUrl] = useState('')
  const [fetching, setFetching] = useState(false)
  const [fetchSuccess, setFetchSuccess] = useState(false)
  const [analyzedSource, setAnalyzedSource] = useState<string | null>(null)

  const analyzeSteps = locale === 'fr'
    ? ['Lecture du site du prospect', 'Identification des dimensions', 'Extraction des informations', 'Construction du profil']
    : ['Reading the prospect site', 'Identifying the dimensions', 'Extracting the information', 'Building the profile']
  const [fetchedDimensions, setFetchedDimensions] = useState<Record<string, unknown> | null>(null)

  // Step 1: Contacts
  const [contacts, setContacts] = useState<Contact[]>([{ name: '', title: '', linkedin: '', actor_types: [] }])

  // Step 2: Revenue
  const [potentialRevenue, setPotentialRevenue] = useState('')

  // ── Analyse the prospect's website ──
  async function handleFetchUrl() {
    if (!prospectUrl.trim()) return
    setFetching(true)
    setError(null)
    try {
      const res = await fetch('/api/context/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: prospectUrl.trim(), locale }),
      })
      const text = await res.text()
      let data: { dimensions?: Record<string, unknown>; error?: string }
      try { data = JSON.parse(text) } catch { throw new Error(`[${res.status}] ${text.slice(0, 200) || 'Empty response'}`) }
      if (!res.ok || data.error) throw new Error(data.error ?? `Request failed (${res.status})`)
      if (data.dimensions) {
        setFetchedDimensions(data.dimensions)
        setFetchSuccess(true)
        setAnalyzedSource(prospectUrl.trim())
      } else {
        throw new Error(locale === 'fr' ? 'Aucune donnée extraite du site.' : 'No data could be extracted from the site.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    }
    setFetching(false)
  }

  // ── Analyse a document instead of a website ──
  async function handleFetchDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFetching(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('locale', locale)
      const res = await fetch('/api/context/from-doc', { method: 'POST', body: formData })
      const text = await res.text()
      let data: { dimensions?: Record<string, unknown>; error?: string }
      try { data = JSON.parse(text) } catch { throw new Error(`[${res.status}] ${text.slice(0, 200) || 'Empty response'}`) }
      if (!res.ok || data.error) throw new Error(data.error ?? `Request failed (${res.status})`)
      if (!data.dimensions) {
        throw new Error(locale === 'fr' ? 'Aucune donnée extraite du document.' : 'No data could be extracted from the document.')
      }
      setFetchedDimensions(data.dimensions)
      setFetchSuccess(true)
      setAnalyzedSource(file.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    }
    setFetching(false)
    e.target.value = ''
  }

  // ── Contact helpers ──
  function updateContact(i: number, field: 'name' | 'title' | 'linkedin', val: string) {
    setContacts(cs => cs.map((c, idx) => idx === i ? { ...c, [field]: val } : c))
  }
  function toggleRole(i: number, role: ActorType) {
    setContacts(cs => cs.map((c, idx) => idx === i
      ? { ...c, actor_types: c.actor_types.includes(role) ? c.actor_types.filter(r => r !== role) : [...c.actor_types, role] }
      : c))
  }
  function addContact() {
    setContacts(cs => [...cs, { name: '', title: '', linkedin: '', actor_types: [] }])
  }
  function removeContact(i: number) {
    if (contacts.length <= 1) return
    setContacts(cs => cs.filter((_, idx) => idx !== i))
  }

  // ── Create deal ──
  async function handleCreate() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const primaryContact = contacts[0]
    const { data: deal, error: dealErr } = await supabase
      .from('deals')
      .insert({
        user_id: user.id,
        prospect_name: prospectName,
        prospect_url: prospectUrl.trim() || null,
        contact_name: primaryContact?.name || null,
        contact_title: primaryContact?.title || null,
        contact_linkedin: primaryContact?.linkedin || null,
        potential_revenue: potentialRevenue ? Number(potentialRevenue) : null,
        prospect_dimensions: fetchedDimensions ?? { _dynamic: true, sales_context: '', dimensions: [] },
        current_round: 0,
      })
      .select()
      .single()

    if (dealErr) { setError(dealErr.message); setLoading(false); return }

    const validContacts = contacts.filter(c => c.name.trim())
    if (validContacts.length > 0) {
      await supabase.from('deal_stakeholders').insert(
        validContacts.map(c => ({
          deal_id: deal.id,
          name: c.name,
          role: c.title || null,
          actor_type: c.actor_types[0] ?? 'unknown',
          actor_types: c.actor_types.length ? c.actor_types : ['unknown'],
          notes: null,
        }))
      )
    }

    router.push(createdHref(deal.id))
    router.refresh()
  }

  const totalSteps = 3

  return (
    <div className="max-w-2xl mx-auto py-12 px-6">
      <div className="mb-10">
        <p className="text-sm text-neutral-400 mb-1">Switch</p>
        <h1 className="text-2xl font-bold text-neutral-900">{t('newDeal.title')}</h1>
        <div className="flex gap-1 mt-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-blue-500' : 'bg-neutral-200'}`} />
          ))}
        </div>
      </div>

      {/* ── Step 0: Who they are, and the material to analyse ── */}
      {step === 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 mb-1">{t('newDeal.prospectCompany')}</h2>
            <p className="text-sm text-neutral-500">{t('newDeal.step0Desc')}</p>
          </div>

          <div className={fetching ? 'opacity-40 pointer-events-none space-y-6' : 'space-y-6'}>
            <div>
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{t('newDeal.prospectCompany')} *</label>
              <input
                type="text" value={prospectName} onChange={e => setProspectName(e.target.value)}
                placeholder="Acme Manufacturing"
                className={inputClass}
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{t('newDeal.prospectUrl')}</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="text" value={prospectUrl} onChange={e => setProspectUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleFetchUrl()}
                  placeholder={t('newDeal.prospectUrlPlaceholder')}
                  disabled={fetching}
                  className="flex-1 bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                />
                <button
                  onClick={handleFetchUrl}
                  disabled={fetching || !prospectUrl.trim() || !prospectName.trim()}
                  className="px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 disabled:opacity-40 transition-all"
                >
                  {fetching ? (locale === 'fr' ? 'Analyse…' : 'Analyzing…') : t('newDeal.analyze')}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-neutral-200" />
              <span className="text-xs text-neutral-300">{t('profile.or')}</span>
              <div className="flex-1 h-px bg-neutral-200" />
            </div>

            <div>
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1.5">
                {t('profile.document')} <span className="text-neutral-300 normal-case">(PDF / .txt)</span>
              </div>
              <label className={`flex items-center justify-center border-2 border-dashed border-neutral-200 bg-white rounded-xl px-4 py-6 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all ${!prospectName.trim() || fetching ? 'opacity-40 pointer-events-none' : ''}`}>
                <span className="text-sm text-neutral-400">
                  {locale === 'fr' ? 'Cliquez pour importer — site, plaquette, appel d’offres, notes' : 'Click to import — site, brochure, RFP, notes'}
                </span>
                <input type="file" accept=".pdf,.txt,.md" onChange={handleFetchDoc} className="hidden" disabled={fetching || !prospectName.trim()} />
              </label>
            </div>
          </div>

          {fetching && (
            <div className="bg-white border border-neutral-200 rounded-2xl p-5">
              <AIProgress steps={analyzeSteps} durationSec={30} />
              <p className="text-xs text-neutral-400 mt-4 text-center">
                {locale === 'fr' ? 'Environ 30 secondes. Restez sur cette page.' : 'About 30 seconds. Stay on this page.'}
              </p>
            </div>
          )}

          {fetchSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl">
              <p className="text-sm text-emerald-700 font-medium">{t('newDeal.contextFetched')}</p>
              <p className="text-xs text-emerald-600/80 mt-0.5">
                {(() => {
                  const where = contextLocation ?? (locale === 'fr' ? 'sur la page Contexte' : 'on the Context page')
                  if (analyzedSource) {
                    return locale === 'fr'
                      ? `Analysé depuis ${analyzedSource}. Vous retrouverez le détail ${where}.`
                      : `Analyzed from ${analyzedSource}. You will find the details ${where}.`
                  }
                  return locale === 'fr'
                    ? `Vous retrouverez le détail ${where}.`
                    : `You will find the details ${where}.`
                })()}
              </p>
            </div>
          )}

          {error && <p className="text-sm text-rose-600">{error}</p>}

          {/* Navigation is withheld while the analysis runs: leaving mid-way
              would drop the result the user is waiting for. */}
          {!fetching && (
            <div className="flex gap-3">
              <button onClick={() => router.back()} className={btnSecondary}>{t('common.cancel')}</button>
              <button onClick={() => setStep(1)} disabled={!prospectName.trim()} className={btnPrimary}>
                {fetchSuccess ? t('onboarding.next') : t('onboarding.skipForNow')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Step 1: Contacts ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 mb-1">{t('newDeal.contactsStep')}</h2>
            <p className="text-sm text-neutral-500">{t('newDeal.contactsStepDesc')}</p>
          </div>
          <div className="space-y-4">
            {contacts.map((c, i) => (
              <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-400 uppercase tracking-wide">{t('newDeal.contact')} {i + 1}</span>
                  {contacts.length > 1 && (
                    <button onClick={() => removeContact(i)} className="text-neutral-300 hover:text-rose-500 text-sm transition-colors">✕</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{t('newDeal.contactName')}</label>
                    <input type="text" value={c.name} onChange={e => updateContact(i, 'name', e.target.value)} placeholder="Sarah Chen" className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{t('newDeal.contactTitle')}</label>
                    <input type="text" value={c.title} onChange={e => updateContact(i, 'title', e.target.value)} placeholder="VP Operations" className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{t('newDeal.contactRole')}</label>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {ACTOR_KEYS.map(a => {
                      const on = c.actor_types.includes(a.value)
                      return (
                        <button
                          key={a.value}
                          type="button"
                          onClick={() => toggleRole(i, a.value)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                            on ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                          }`}
                        >
                          {t(a.key as never)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
            <button onClick={addContact} className="text-sm font-medium text-blue-500 hover:text-blue-600 transition-colors">
              + {t('newDeal.addContact')}
            </button>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(0)} className={btnSecondary}>{t('onboarding.back')}</button>
            <button onClick={() => setStep(2)} className={btnPrimary}>
              {contacts[0]?.name ? t('onboarding.next') : t('onboarding.skipForNow')}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Revenue ── */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 mb-1">{t('newDeal.revenueStep')}</h2>
            <p className="text-sm text-neutral-500">{t('newDeal.revenueStepDesc')}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{t('newDeal.potentialRevenue')}</label>
            <input
              type="number" value={potentialRevenue} onChange={e => setPotentialRevenue(e.target.value)}
              placeholder="50000" min="0"
              className={inputClass}
            />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className={btnSecondary}>{t('onboarding.back')}</button>
            <button onClick={handleCreate} disabled={loading} className={btnPrimary}>
              {loading ? t('newDeal.creating') : t('newDeal.create')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
