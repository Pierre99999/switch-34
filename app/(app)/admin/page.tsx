'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ADMIN_EMAIL } from '@/lib/admin-config'

type AdminUser = {
  userId: string
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

type FeedbackStatus = 'new' | 'rejected' | 'in_progress' | 'done'

type Feedback = {
  id: string
  author: string
  sentiment: 'positive' | 'negative' | 'neutral'
  message: string
  page: string | null
  status: FeedbackStatus
  createdAt: string
}

const FEEDBACK_STATUSES: { value: FeedbackStatus; label: string; on: string; off: string }[] = [
  { value: 'new',         label: 'Nouveau',   on: 'bg-neutral-800 text-white border-neutral-800', off: 'text-neutral-500 border-neutral-200 hover:border-neutral-400' },
  { value: 'in_progress', label: 'En cours',  on: 'bg-amber-500 text-white border-amber-500',     off: 'text-amber-600 border-amber-200 hover:border-amber-400' },
  { value: 'done',        label: 'Appliqué',  on: 'bg-emerald-500 text-white border-emerald-500', off: 'text-emerald-600 border-emerald-200 hover:border-emerald-400' },
  { value: 'rejected',    label: 'Refusé',    on: 'bg-rose-500 text-white border-rose-500',       off: 'text-rose-600 border-rose-200 hover:border-rose-400' },
]

type Stats = {
  totals: { users: number; directors: number; sales: number; deals: number; rounds: number; briefedRounds: number; analyzedRounds: number; inputTokens: number; outputTokens: number; costEur: number; feedback: number; feedbackPositive: number; feedbackNegative: number }
  dealsByStatus: Record<string, number>
  users: AdminUser[]
  feedback: Feedback[]
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
  const [selfId, setSelfId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [feedbackFilter, setFeedbackFilter] = useState<FeedbackStatus | 'all'>('all')

  const loadStats = useCallback(async () => {
    const res = await fetch('/api/admin/stats')
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Erreur'); setLoading(false); return }
    setStats(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || (user.email ?? '').toLowerCase() !== ADMIN_EMAIL) {
        router.replace('/pipeline')
        return
      }
      setSelfId(user.id)
      await loadStats()
    })()
  }, [router, loadStats])

  async function handleFeedbackStatus(id: string, status: FeedbackStatus) {
    // Optimistic: reflect the new status immediately, revert on failure.
    setStats(prev => prev ? { ...prev, feedback: prev.feedback.map(f => f.id === id ? { ...f, status } : f) } : prev)
    const res = await fetch('/api/admin/feedback-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    if (!res.ok) await loadStats()
  }

  async function handleDelete(userId: string) {
    setDeletingId(userId)
    const res = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    const data = await res.json()
    setDeletingId(null)
    setConfirmId(null)
    if (!res.ok) { setError(data.error ?? 'Suppression impossible'); return }
    await loadStats()
  }

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

  const visibleFeedback = feedbackFilter === 'all'
    ? stats.feedback
    : stats.feedback.filter(f => f.status === feedbackFilter)

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
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
        {stat('Retours', stats.totals.feedback)}
        {stat('👍 Positifs', stats.totals.feedbackPositive, 'text-emerald-600')}
        {stat('👎 Négatifs', stats.totals.feedbackNegative, 'text-rose-600')}
      </div>

      {/* Feedback */}
      {stats.feedback.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Retours des testeurs ({stats.feedback.length})</h2>

          <div className="flex gap-2 mb-4 flex-wrap">
            {([['all', 'Tout'], ...FEEDBACK_STATUSES.map(st => [st.value, st.label] as const)] as [FeedbackStatus | 'all', string][]).map(([value, label]) => {
              const count = value === 'all' ? stats.feedback.length : stats.feedback.filter(f => f.status === value).length
              const active = feedbackFilter === value
              return (
                <button
                  key={value}
                  onClick={() => setFeedbackFilter(value)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                    active ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                  }`}
                >
                  {label} <span className={active ? 'opacity-70' : 'text-neutral-400'}>{count}</span>
                </button>
              )
            })}
          </div>

          {visibleFeedback.length === 0 && (
            <p className="text-sm text-neutral-400 mb-4">Aucun retour dans cette catégorie.</p>
          )}

          <div className="space-y-3">
            {visibleFeedback.map((f, i) => (
              <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-base">{f.sentiment === 'positive' ? '👍' : f.sentiment === 'negative' ? '👎' : '💬'}</span>
                  <span className="text-sm font-semibold text-neutral-800">{f.author}</span>
                  {f.page && <span className="text-[11px] font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">{f.page}</span>}
                  <span className="text-xs text-neutral-400 ml-auto">{fmtDate(f.createdAt)}</span>
                </div>
                <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">{f.message}</p>
                <div className="flex gap-1.5 mt-3 pt-3 border-t border-neutral-100 flex-wrap">
                  {FEEDBACK_STATUSES.map(st => (
                    <button
                      key={st.value}
                      onClick={() => handleFeedbackStatus(f.id, st.value)}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${f.status === st.value ? st.on : `bg-white ${st.off}`}`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Comptes ({stats.users.length})</h2>
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
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
              <th className="px-4 py-3 text-right">Actions</th>
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
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {u.userId === selfId ? (
                    <span className="text-xs text-neutral-300">—</span>
                  ) : confirmId === u.userId ? (
                    <span className="inline-flex items-center gap-2">
                      <button
                        onClick={() => handleDelete(u.userId)}
                        disabled={deletingId === u.userId}
                        className="text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg px-2.5 py-1 disabled:opacity-40 transition-all"
                      >
                        {deletingId === u.userId ? 'Suppression…' : 'Confirmer'}
                      </button>
                      <button onClick={() => setConfirmId(null)} className="text-xs text-neutral-400 hover:text-neutral-600">Annuler</button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmId(u.userId)} className="text-xs font-medium text-neutral-400 hover:text-rose-600 transition-colors">
                      Supprimer
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
