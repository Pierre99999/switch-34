'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const TABS = [
  { label: 'Pipeline', href: '/pipeline', group: 'main' },
  { label: 'Dashboard', href: null, group: 'deal' },
  { label: 'Briefing', href: null, group: 'deal' },
  { label: 'Capture', href: null, group: 'deal' },
  { label: 'Account Context', href: null, group: 'context' },
  { label: 'Boxes', href: null, group: 'context' },
]

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()

  // Extract deal id from path if present
  const dealMatch = pathname.match(/\/deals\/([^/]+)/)
  const dealId = dealMatch?.[1]

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
      className={`px-3 py-1.5 text-[11px] uppercase tracking-widest font-mono whitespace-nowrap ${
        active ? 'bg-stone-900 text-stone-50' : 'text-stone-500 hover:text-stone-900'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <div className="border-b border-stone-300 bg-white sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-11">
        <div className="flex items-center gap-0.5">
          {tab('Pipeline', '/pipeline', pathname === '/pipeline')}
          {tab('My Profile', '/profile', pathname === '/profile')}
          {dealId && (
            <>
              <span className="text-stone-200 mx-2 select-none">|</span>
              {tab('Dashboard', dealHref('dashboard'), isActive('dashboard'))}
              {tab('Briefing', dealHref('briefing'), isActive('briefing'))}
              {tab('Capture', dealHref('capture'), isActive('capture'))}
              <span className="text-stone-200 mx-2 select-none">|</span>
              {tab('Account Context', dealHref('context'), isActive('context'))}
              {tab('Boxes', dealHref('boxes'), isActive('boxes'))}
            </>
          )}
        </div>
        <button
          onClick={handleSignOut}
          className="text-[10px] uppercase tracking-widest text-stone-400 font-mono hover:text-stone-900"
        >
          sign out
        </button>
      </div>
    </div>
  )
}
