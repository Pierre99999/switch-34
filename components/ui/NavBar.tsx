'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { useRole } from '@/lib/role-context'

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { t, locale, setLocale } = useI18n()
  const { role, fullName } = useRole()

  const dealMatch = pathname.match(/\/deals\/([^/]+)/)
  const rawDealId = dealMatch?.[1]
  const dealId = rawDealId && rawDealId !== 'new' ? rawDealId : undefined

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

  return (
    <nav className="border-b border-neutral-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-1">
          <span className="text-lg font-bold text-blue-500 mr-4 tracking-tight">Switch</span>
          {tab(t('nav.pipeline'), '/pipeline', pathname === '/pipeline')}
          {tab(t('nav.profile'), '/profile', pathname === '/profile')}
          {role === 'director' && tab(t('nav.team'), '/team', pathname === '/team')}
          {dealId && (
            <>
              <div className="w-px h-5 bg-neutral-200 mx-2" />
              {dealTab(t('nav.dashboard'), 'dashboard', 'bg-neutral-800')}
              {dealTab(t('nav.briefing'), 'briefing', 'bg-orange-500')}
              {dealTab(t('nav.capture'), 'capture', 'bg-violet-500')}
              <div className="w-px h-5 bg-neutral-200 mx-2" />
              {dealTab(t('nav.context'), 'context', 'bg-cyan-600')}
              {dealTab(t('nav.zones'), 'zones', 'bg-emerald-600')}
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {fullName && <span className="text-[11px] text-neutral-400">{fullName}</span>}
          <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${role === 'director' ? 'bg-blue-50 text-blue-600' : 'bg-neutral-100 text-neutral-500'}`}>
            {t(('role.' + role) as any)}
          </span>
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
      </div>
    </nav>
  )
}
