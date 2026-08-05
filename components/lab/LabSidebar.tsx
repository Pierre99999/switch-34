'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Deliberately short. Everything scoped to a deal lives inside the deal
// screen — putting Dashboard / Briefing / Conversation here would rebuild the
// tab navigation this interface exists to remove.
const ITEMS = [
  { href: '/lab', label: 'Deals', icon: '◎' },
  { href: '/playbook', label: 'Sales Playbook', icon: '📘' },
  { href: '/admin', label: 'Admin', icon: '⚙' },
]

export default function LabSidebar({
  counts,
}: {
  counts?: { active: number; nearClose: number; atRisk: number; archived: number }
}) {
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

      {counts && (
        <div className="px-5 mt-8">
          <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-2">Mon pipeline</div>
          <ul className="space-y-1.5">
            {[
              { label: 'Actifs', value: counts.active, dot: 'bg-blue-500' },
              { label: 'Proches', value: counts.nearClose, dot: 'bg-emerald-500' },
              { label: 'À risque', value: counts.atRisk, dot: 'bg-rose-500' },
              { label: 'Archivés', value: counts.archived, dot: 'bg-neutral-300' },
            ].map(row => (
              <li key={row.label} className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${row.dot}`} />
                <span className="text-neutral-600">{row.label}</span>
                <span className="ml-auto text-neutral-400">{row.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto px-4 py-4 border-t border-neutral-100">
        <Link href="/pipeline" className="text-xs text-neutral-400 hover:text-neutral-600">
          ← Revenir à l&apos;interface actuelle
        </Link>
      </div>
    </aside>
  )
}
