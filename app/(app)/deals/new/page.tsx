'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'

const inputClass = "mt-1 w-full border border-stone-300 bg-white px-3 py-2.5 text-sm font-mono text-stone-900 focus:outline-none focus:border-stone-900"
const btnPrimary = "flex-1 bg-stone-900 text-stone-50 py-2.5 text-xs uppercase tracking-widest font-mono hover:bg-stone-800 disabled:opacity-40"
const btnSecondary = "px-6 py-2.5 text-xs uppercase tracking-widest font-mono text-stone-600 border border-stone-300 hover:border-stone-600"

type Contact = { name: string; title: string; linkedin: string }

export default function NewDealPage() {
  const router = useRouter()
  const { t, locale } = useI18n()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 0: Prospect name + context
  const [prospectName, setProspectName] = useState('')
  const [salesContext, setSalesContext] = useState('')

  // Step 1: URL + context fetch
  const [prospectUrl, setProspectUrl] = useState('')
  const [fetching, setFetching] = useState(false)
  const [fetchSuccess, setFetchSuccess] = useState(false)
  const [fetchedDimensions, setFetchedDimensions] = useState<Record<string, unknown> | null>(null)

  // Step 2: Contacts
  const [contacts, setContacts] = useState<Contact[]>([{ name: '', title: '', linkedin: '' }])

  // Step 3: Revenue
  const [potentialRevenue, setPotentialRevenue] = useState('')

  // ── Step 1: Fetch context from URL ──
  async function handleFetchUrl() {
    if (!prospectUrl.trim()) return
    setFetching(true)
    setError(null)
    try {
      const res = await fetch('/api/context/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: prospectUrl.trim(), locale, salesContext: salesContext.trim() || undefined }),
      })
      const data = await res.json()
      if (data.dimensions) {
        setFetchedDimensions(data.dimensions)
        setFetchSuccess(true)
      }
    } catch {
      setError('Network error')
    }
    setFetching(false)
  }

  // ── Contact helpers ──
  function updateContact(i: number, field: keyof Contact, val: string) {
    setContacts(cs => cs.map((c, idx) => idx === i ? { ...c, [field]: val } : c))
  }
  function addContact() {
    setContacts(cs => [...cs, { name: '', title: '', linkedin: '' }])
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
        prospect_dimensions: fetchedDimensions ?? { _dynamic: true, sales_context: salesContext.trim(), dimensions: [] },
        current_round: 0,
      })
      .select()
      .single()

    if (dealErr) { setError(dealErr.message); setLoading(false); return }

    await supabase.from('deal_rounds').insert({ deal_id: deal.id, round: 0 })

    router.push(`/deals/${deal.id}/context`)
    router.refresh()
  }

  const totalSteps = 4

  return (
    <div className="max-w-2xl mx-auto py-12 px-6">
      <div className="mb-10">
        <div className="text-xs uppercase tracking-widest text-stone-500 font-mono mb-2">Switch</div>
        <h1 className="font-serif text-3xl text-stone-900 italic">{t('newDeal.title')}</h1>
        <div className="flex gap-1 mt-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-stone-900' : 'bg-stone-200'}`} />
          ))}
        </div>
      </div>

      {/* ── Step 0: Prospect name ── */}
      {step === 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-stone-900 font-mono mb-1">{t('newDeal.prospectCompany')}</h2>
            <p className="text-sm text-stone-500">{t('newDeal.step0Desc')}</p>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">{t('newDeal.prospectCompany')} *</label>
            <input
              type="text" value={prospectName} onChange={e => setProspectName(e.target.value)}
              placeholder="Acme Manufacturing"
              className={inputClass}
              autoFocus
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">{t('newDeal.salesContext')}</label>
            <textarea
              value={salesContext} onChange={e => setSalesContext(e.target.value)}
              placeholder={t('newDeal.salesContextPlaceholder')}
              rows={4}
              className="mt-1 w-full border border-stone-300 bg-white px-3 py-2.5 text-sm font-mono text-stone-900 focus:outline-none focus:border-stone-900 resize-y"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.back()} className={btnSecondary}>{t('common.cancel')}</button>
            <button onClick={() => setStep(1)} disabled={!prospectName.trim()} className={btnPrimary}>
              {t('onboarding.next')}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 1: URL + context fetch ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-stone-900 font-mono mb-1">{t('newDeal.contextStep')}</h2>
            <p className="text-sm text-stone-500">{t('newDeal.contextStepDesc')}</p>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">{t('newDeal.prospectUrl')}</label>
            <div className="flex gap-2 mt-1">
              <input
                type="text" value={prospectUrl} onChange={e => setProspectUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleFetchUrl()}
                placeholder={t('newDeal.prospectUrlPlaceholder')}
                disabled={fetching}
                className="flex-1 border border-stone-300 bg-white px-3 py-2.5 text-sm font-mono text-stone-900 focus:outline-none focus:border-stone-900"
              />
              <button
                onClick={handleFetchUrl}
                disabled={fetching || !prospectUrl.trim()}
                className="px-5 py-2.5 bg-stone-900 text-stone-50 text-xs font-mono uppercase tracking-widest hover:bg-stone-800 disabled:opacity-40"
              >
                {fetching ? '…' : t('newDeal.analyze')}
              </button>
            </div>
          </div>
          {fetchSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-lg">
              <p className="text-sm text-emerald-700 font-mono">{t('newDeal.contextFetched')}</p>
            </div>
          )}
          {error && <p className="text-xs text-rose-700 font-mono">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => setStep(0)} className={btnSecondary}>{t('onboarding.back')}</button>
            <button onClick={() => setStep(2)} className={btnPrimary}>
              {fetchSuccess ? t('onboarding.next') : t('onboarding.skipForNow')}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Contacts ── */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-stone-900 font-mono mb-1">{t('newDeal.contactsStep')}</h2>
            <p className="text-sm text-stone-500">{t('newDeal.contactsStepDesc')}</p>
          </div>
          <div className="space-y-4">
            {contacts.map((c, i) => (
              <div key={i} className="border border-stone-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-stone-400 uppercase tracking-widest">{t('newDeal.contact')} {i + 1}</span>
                  {contacts.length > 1 && (
                    <button onClick={() => removeContact(i)} className="text-stone-300 hover:text-rose-500 text-sm transition-colors">✕</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">{t('newDeal.contactName')}</label>
                    <input type="text" value={c.name} onChange={e => updateContact(i, 'name', e.target.value)} placeholder="Sarah Chen" className={inputClass} />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">{t('newDeal.contactTitle')}</label>
                    <input type="text" value={c.title} onChange={e => updateContact(i, 'title', e.target.value)} placeholder="VP Operations" className={inputClass} />
                  </div>
                </div>
              </div>
            ))}
            <button onClick={addContact} className="text-sm font-medium text-stone-500 hover:text-stone-900 font-mono transition-colors">
              + {t('newDeal.addContact')}
            </button>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className={btnSecondary}>{t('onboarding.back')}</button>
            <button onClick={() => setStep(3)} className={btnPrimary}>
              {contacts[0]?.name ? t('onboarding.next') : t('onboarding.skipForNow')}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Revenue ── */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-stone-900 font-mono mb-1">{t('newDeal.revenueStep')}</h2>
            <p className="text-sm text-stone-500">{t('newDeal.revenueStepDesc')}</p>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">{t('newDeal.potentialRevenue')}</label>
            <input
              type="number" value={potentialRevenue} onChange={e => setPotentialRevenue(e.target.value)}
              placeholder="50000" min="0"
              className={inputClass}
            />
          </div>
          {error && <p className="text-xs text-rose-700 font-mono">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className={btnSecondary}>{t('onboarding.back')}</button>
            <button onClick={handleCreate} disabled={loading} className={btnPrimary}>
              {loading ? t('newDeal.creating') : t('newDeal.create')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
