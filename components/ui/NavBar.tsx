'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { useRole } from '@/lib/role-context'

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { t, locale, setLocale } = useI18n()
  const { role } = useRole()
  const [prospectName, setProspectName] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const dealMatch = pathname.match(/\/deals\/([^/]+)/)
  const rawDealId = dealMatch?.[1]
  const dealId = rawDealId && rawDealId !== 'new' ? rawDealId : undefined

  useEffect(() => {
    if (!dealId) { setProspectName(null); return }
    const supabase = createClient()
    supabase.from('deals').select('prospect_name').eq('id', dealId).single()
      .then(({ data }) => setProspectName(data?.prospect_name ?? null))
  }, [dealId])

  useEffect(() => { setMenuOpen(false) }, [pathname])

  function dealHref(view: string) {
    if (!dealId) return '#'
    return `/deals/${dealId}/${view}`
  }

  function isActive(view: string) {
    if (!dealId) return false
    return pathname.includes(`/deals/${dealId}/${view}`)
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const tab = (label: string, href: string, active: boolean) => (
    <Link
      key={label}
      href={href}
      className={`px-3.5 py-1.5 text-[12px] font-medium tracking-wide rounded-full transition-all whitespace-nowrap ${
        active
          ? 'bg-blue-500 text-white shadow-sm'
          : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
      }`}
    >
      {label}
    </Link>
  )

  const dealTab = (label: string, view: string, color: string) => {
    const active = isActive(view)
    return (
      <Link
        key={label}
        href={dealHref(view)}
        className={`px-3.5 py-1.5 text-[12px] font-medium tracking-wide rounded-full transition-all whitespace-nowrap ${
          active
            ? `text-white shadow-sm ${color}`
            : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
        }`}
      >
        {label}
      </Link>
    )
  }

  const mobileItem = (label: string, href: string, active: boolean, color?: string) => (
    <Link
      key={label}
      href={href}
      onClick={() => setMenuOpen(false)}
      className={`block px-4 py-3 text-sm font-medium rounded-lg transition-all ${
        active
          ? `text-white shadow-sm ${color ?? 'bg-blue-500'}`
          : 'text-neutral-700 hover:bg-neutral-100'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <nav className="border-b border-neutral-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          <span className="text-lg font-bold text-blue-500 mr-4 tracking-tight">Switch</span>
          {tab(t('nav.pipeline'), '/pipeline', pathname === '/pipeline')}
          {tab(t('nav.profile'), '/profile', pathname === '/profile')}
          {role === 'director' && tab(t('nav.team'), '/team', pathname === '/team')}
          {dealId && (
            <>
              <div className="w-px h-5 bg-neutral-200 mx-2" />
              {dealTab(prospectName ? `${t('nav.context')} ${prospectName}` : t('nav.context'), 'context', 'bg-cyan-600')}
              {dealTab(t('nav.dashboard'), 'dashboard', 'bg-neutral-800')}
              {dealTab(t('nav.briefing'), 'briefing', 'bg-orange-500')}
              {dealTab(t('nav.capture'), 'capture', 'bg-violet-500')}
              {dealTab(t('nav.zones'), 'zones', 'bg-emerald-600')}
            </>
          )}
        </div>
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => setLocale(locale === 'fr' ? 'en' : 'fr')}
            className="text-[11px] font-semibold text-neutral-400 hover:text-neutral-700 transition-colors uppercase tracking-wide"
          >
            {locale === 'fr' ? 'EN' : 'FR'}
          </button>
          <button
            onClick={handleSignOut}
            className="text-[11px] font-medium text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            {t('nav.signOut')}
          </button>
        </div>

        {/* Mobile nav */}
        <div className="flex md:hidden items-center justify-between w-full">
          <span className="text-lg font-bold text-blue-500 tracking-tight">Switch</span>
          <button
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Menu"
            className="p-2 -mr-2 text-neutral-700 hover:bg-neutral-100 rounded-lg"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {menuOpen ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></> : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden border-t border-neutral-200 bg-white">
          <div className="max-w-6xl mx-auto px-4 py-3 space-y-1">
            {mobileItem(t('nav.pipeline'), '/pipeline', pathname === '/pipeline')}
            {mobileItem(t('nav.profile'), '/profile', pathname === '/profile')}
            {role === 'director' && mobileItem(t('nav.team'), '/team', pathname === '/team')}
            {dealId && (
              <>
                <div className="h-px bg-neutral-200 my-2" />
                {mobileItem(prospectName ? `${t('nav.context')} ${prospectName}` : t('nav.context'), dealHref('context'), isActive('context'), 'bg-cyan-600')}
                {mobileItem(t('nav.dashboard'), dealHref('dashboard'), isActive('dashboard'), 'bg-neutral-800')}
                {mobileItem(t('nav.briefing'), dealHref('briefing'), isActive('briefing'), 'bg-orange-500')}
                {mobileItem(t('nav.capture'), dealHref('capture'), isActive('capture'), 'bg-violet-500')}
                {mobileItem(t('nav.zones'), dealHref('zones'), isActive('zones'), 'bg-emerald-600')}
              </>
            )}
            <div className="h-px bg-neutral-200 my-2" />
            <div className="flex items-center justify-end px-4 py-2">
              <button
                onClick={() => setLocale(locale === 'fr' ? 'en' : 'fr')}
                className="text-xs font-semibold text-neutral-500 hover:text-neutral-800 uppercase tracking-wide"
              >
                {locale === 'fr' ? 'EN' : 'FR'}
              </button>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-3 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-lg"
            >
              {t('nav.signOut')}
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
