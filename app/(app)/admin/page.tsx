'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ADMIN_EMAIL } from '@/lib/admin-config'

type AdminUser = {
  email: string
  name: string | null
  company: string | null
  role: string
  locale: string | null
  deals: number
  tokens: number
  costEur: number
  createdAt: string
  lastSignIn: string | null
}

type Stats = {
  totals: { users: number; directors: number; sales: number; deals: number; rounds: number; briefedRounds: number; analyzedRounds: number; inputTokens: number; outputTokens: number; costEur: number }
  dealsByStatus: Record<string, number>
  users: AdminUser[]
}

const fmtTokens = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : String(n)
const fmtEur = (n: number) => `${n.toFixed(2)} €`

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const ROLE_LABEL: Record<string, string> = { director: 'Directeur', sales: 'Commercial', unknown: '—' }

export default function AdminPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || (user.email ?? '').toLowerCase() !== ADMIN_EMAIL) {
        router.replace('/pipeline')
        return
      }
      const res = await fetch('/api/admin/stats')
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erreur'); setLoading(false); return }
      setStats(data)
      setLoading(false)
    })()
  }, [router])

  if (loading) return <div className="max-w-6xl mx-auto py-8 px-6 text-sm text-neutral-400">Chargement…</div>
  if (error) return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      <h1 className="text-2xl font-bold text-neutral-900 mb-3">Admin</h1>
      <p className="text-sm text-rose-600">{error}</p>
      {error.includes('SERVICE_ROLE') && (
        <p className="text-sm text-neutral-500 mt-2">Ajoute <code className="bg-neutral-100 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> dans les variables d&apos;environnement Vercel (Supabase → Settings → API → service_role) puis redéploie.</p>
      )}
    </div>
  )
  if (!stats) return null

  const stat = (label: string, value: number | string, accent = 'text-neutral-900') => (
    <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
      <div className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-3xl font-bold ${accent}`}>{value}</div>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
      <h1 className="text-2xl font-bold text-neutral-900 mb-1">Admin</h1>
      <p className="text-sm text-neutral-500 mb-8">Vue d&apos;ensemble de l&apos;usage du produit.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        {stat('Comptes', stats.totals.users)}
        {stat('Directeurs', stats.totals.directors, 'text-blue-600')}
        {stat('Commerciaux', stats.totals.sales, 'text-violet-600')}
        {stat('Deals', stats.totals.deals, 'text-emerald-600')}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        {stat('Conversations analysées', stats.totals.analyzedRounds)}
        {stat('Briefings générés', stats.totals.briefedRounds)}
        {stat('Rounds totaux', stats.totals.rounds)}
        {stat('Deals gagnés', stats.dealsByStatus.won ?? 0, 'text-emerald-600')}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {stat('Tokens (entrée)', fmtTokens(stats.totals.inputTokens))}
        {stat('Tokens (sortie)', fmtTokens(stats.totals.outputTokens))}
        {stat('Coût IA total', fmtEur(stats.totals.costEur), 'text-rose-600')}
        {stat('Coût / compte', fmtEur(stats.totals.users ? stats.totals.costEur / stats.totals.users : 0))}
      </div>

      <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Comptes ({stats.users.length})</h2>
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50/50 text-left text-xs font-medium text-neutral-400 uppercase tracking-wide">
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Entreprise</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Langue</th>
              <th className="px-4 py-3 text-right">Deals</th>
              <th className="px-4 py-3 text-right">Tokens</th>
              <th className="px-4 py-3 text-right">Coût IA</th>
              <th className="px-4 py-3">Créé le</th>
              <th className="px-4 py-3">Dernière connexion</th>
            </tr>
          </thead>
          <tbody>
            {stats.users.map((u, i) => (
              <tr key={i} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3 font-medium text-neutral-800">{u.name ?? '—'}</td>
                <td className="px-4 py-3 text-neutral-500">{u.email}</td>
                <td className="px-4 py-3 text-neutral-500">{u.company ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.role === 'director' ? 'bg-blue-50 text-blue-600' : u.role === 'sales' ? 'bg-violet-50 text-violet-600' : 'bg-neutral-100 text-neutral-500'}`}>
                    {ROLE_LABEL[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-500 uppercase">{u.locale ?? '—'}</td>
                <td className="px-4 py-3 text-right font-semibold text-neutral-700">{u.deals}</td>
                <td className="px-4 py-3 text-right text-neutral-600">{fmtTokens(u.tokens)}</td>
                <td className="px-4 py-3 text-right font-medium text-rose-600">{fmtEur(u.costEur)}</td>
                <td className="px-4 py-3 text-neutral-500">{fmtDate(u.createdAt)}</td>
                <td className="px-4 py-3 text-neutral-500">{fmtDate(u.lastSignIn)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
