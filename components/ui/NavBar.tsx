'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()

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
          <span className="text-lg font-bold text-blue-500 mr-4 tracking-tight">ScoreJam</span>
          {tab('Pipeline', '/pipeline', pathname === '/pipeline')}
          {tab('My Profile', '/profile', pathname === '/profile')}
          {dealId && (
            <>
              <div className="w-px h-5 bg-neutral-200 mx-2" />
              {dealTab('Dashboard', 'dashboard', 'bg-neutral-800')}
              {dealTab('Briefing', 'briefing', 'bg-orange-500')}
              {dealTab('Capture', 'capture', 'bg-violet-500')}
              <div className="w-px h-5 bg-neutral-200 mx-2" />
              {dealTab('Context', 'context', 'bg-cyan-600')}
              {dealTab('Boxes', 'boxes', 'bg-emerald-600')}
            </>
          )}
        </div>
        <button
          onClick={handleSignOut}
          className="text-[11px] font-medium text-neutral-400 hover:text-neutral-700 transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
