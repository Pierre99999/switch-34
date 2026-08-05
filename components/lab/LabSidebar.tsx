'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Line icons drawn inline rather than pulled from a font or an emoji: a glyph
// like "◎" or "📘" renders differently on every machine and carries its own
// weight and colour. These inherit both from the link.
function Icon({ name, className }: { name: 'pipeline' | 'playbook' | 'admin'; className?: string }) {
  const paths = {
    pipeline: <><path d="M4 6h16" /><path d="M4 12h11" /><path d="M4 18h6" /></>,
    playbook: <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a1.5 1.5 0 0 0-1.5-1.5H5.5A1.5 1.5 0 0 1 4 16z" /><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 0 20 16z" /></>,
    admin: <><path d="M4 8h10" /><path d="M18 8h2" /><circle cx="16" cy="8" r="2" /><path d="M4 16h4" /><path d="M12 16h8" /><circle cx="10" cy="16" r="2" /></>,
  }[name]
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      {paths}
    </svg>
  )
}

// Deliberately short. Everything scoped to a deal lives inside the deal
// screen — putting Dashboard / Briefing / Conversation here would rebuild the
// tab navigation this interface exists to remove.
const ITEMS = [
  { href: '/lab', label: 'Pipeline', icon: 'pipeline' },
  { href: '/lab/playbook', label: 'Sales Playbook', icon: 'playbook' },
  { href: '/lab/admin', label: 'Admin', icon: 'admin' },
] as const

export default function LabSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 flex-shrink-0 border-r border-neutral-200 bg-white min-h-screen hidden lg:flex flex-col">
      <div className="px-5 py-5">
        <Link href="/lab" className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-blue-500 text-white font-bold flex items-center justify-center">S</span>
          <span className="text-lg font-bold text-neutral-900">Switch</span>
        </Link>
      </div>

      <div className="px-4">
        <Link
          href="/lab/deals/new"
          className="flex items-center justify-center gap-2 w-full bg-blue-500 text-white py-2.5 text-sm font-semibold rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 transition-all"
        >
          + Nouveau deal
        </Link>
      </div>

      <nav className="px-3 mt-5 space-y-0.5">
        {ITEMS.map(item => {
          const active = pathname === item.href || (item.href === '/lab' && pathname.startsWith('/lab/deals'))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                active ? 'bg-blue-50 text-blue-700' : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              <Icon name={item.icon} className={`w-[18px] h-[18px] flex-shrink-0 ${active ? 'text-blue-500' : 'text-neutral-400'}`} />
              {item.label}
            </Link>
          )
        })}
      </nav>


      <div className="mt-auto px-4 py-4 border-t border-neutral-100">
        <Link href="/pipeline" className="text-xs text-neutral-400 hover:text-neutral-600">
          ← Revenir à l&apos;interface actuelle
        </Link>
      </div>
    </aside>
  )
}
