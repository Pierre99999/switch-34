'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Deliberately short. Everything scoped to a deal lives inside the deal
// screen — putting Dashboard / Briefing / Conversation here would rebuild the
// tab navigation this interface exists to remove.
const ITEMS = [
  { href: '/lab', label: 'Pipeline', icon: '◎' },
  { href: '/playbook', label: 'Sales Playbook', icon: '📘' },
  { href: '/admin', label: 'Admin', icon: '⚙' },
]

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
          href="/deals/new"
          className="flex items-center justify-center gap-2 w-full bg-blue-500 text-white py-2.5 text-sm font-semibold rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 transition-all"
        >
          + Nouveau deal
        </Link>
      </div>

      <nav className="px-3 mt-5 space-y-0.5">
        {ITEMS.map(item => {
          const active = pathname === item.href || (item.href === '/lab' && pathname.startsWith('/lab'))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                active ? 'bg-blue-50 text-blue-700' : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              <span className="text-neutral-400">{item.icon}</span>
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
