'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'

export default function OnboardingPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [companyUrl, setCompanyUrl] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error } = await supabase.from('vendors').insert({
      user_id: user.id,
      company_name: companyName,
      company_url: companyUrl,
    })

    if (error) { setError(error.message); setLoading(false); return }
    router.push('/profile')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto py-20 px-6">
        <div className="mb-10">
          <div className="text-xs uppercase tracking-widest text-stone-500 font-mono mb-2">Switch · setup</div>
          <h1 className="font-serif text-3xl text-stone-900 italic">{t('onboarding.title')}</h1>
          <p className="text-sm text-stone-500 mt-2 leading-relaxed">
            {t('onboarding.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">{t('onboarding.companyName')}</label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder={t('onboarding.companyNamePlaceholder')}
              required
              className="mt-1 w-full border border-stone-300 bg-white px-3 py-2.5 text-sm font-mono text-stone-900 focus:outline-none focus:border-stone-900"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">{t('onboarding.website')}</label>
            <input
              type="text"
              value={companyUrl}
              onChange={e => setCompanyUrl(e.target.value)}
              placeholder={t('onboarding.websitePlaceholder')}
              className="mt-1 w-full border border-stone-300 bg-white px-3 py-2.5 text-sm font-mono text-stone-900 focus:outline-none focus:border-stone-900"
            />
          </div>

          {error && <p className="text-xs text-rose-700 font-mono">{error}</p>}

          <button
            type="submit"
            disabled={!companyName.trim() || loading}
            className="w-full bg-stone-900 text-stone-50 py-3 text-xs uppercase tracking-widest font-mono hover:bg-stone-800 disabled:opacity-40"
          >
            {loading ? t('onboarding.saving') : t('onboarding.submit')}
          </button>
        </form>
      </div>
    </div>
  )
}
