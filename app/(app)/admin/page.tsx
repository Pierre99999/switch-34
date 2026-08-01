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
  orphans?: OrphanUser[]
  organizations?: { id: string; name: string }[]
  feedback: Feedback[]
}

// An auth identity with no vendor row behind it.
type OrphanUser = {
  userId: string
  email: string
  confirmed: boolean
  createdAt: string
  lastSignIn: string | null
}

const fmtTokens = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : String(n)
const fmtEur = (n: number) => `${n.toFixed(2)} €`

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const ROLE_LABEL: Record<string, string> = { director: 'Directeur', sales: 'Commercial', unknown: '—' }

const adminInput = "mt-1 w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder:text-neutral-300 transition-all"

export default function AdminPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selfId, setSelfId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [feedbackFilter, setFeedbackFilter] = useState<FeedbackStatus | 'all'>('all')
  const [actionError, setActionError] = useState<string | null>(null)

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

  // ── Test account creation ──
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newCompany, setNewCompany] = useState('')
  const [newRole, setNewRole] = useState<'director' | 'sales'>('director')
  const [newLocale, setNewLocale] = useState<'fr' | 'en'>('fr')
  const [newOrgId, setNewOrgId] = useState('')
  const [skipOnboarding, setSkipOnboarding] = useState(true)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleCreateAccount() {
    setCreating(true)
    setCreateError(null)
    setCreated(null)
    const res = await fetch('/api/admin/create-test-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newEmail, fullName: newName, companyName: newCompany,
        role: newRole, locale: newLocale, skipOnboarding,
        organizationId: newRole === 'sales' ? newOrgId : null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setCreating(false)
    if (!res.ok) { setCreateError(data.error ?? `Création impossible (${res.status})`); return }
    setCreated({ email: data.email, password: data.password })
    setNewEmail(''); setNewName(''); setNewCompany(''); setNewOrgId('')
    await loadStats()
  }

  async function handleDelete(userId: string) {
    setDeletingId(userId)
    setActionError(null)
    const res = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    const data = await res.json().catch(() => ({}))
    setDeletingId(null)
    setConfirmId(null)
    if (!res.ok) { setActionError(data.error ?? `Suppression impossible (${res.status})`); return }
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
      {actionError && (
        <div className="mb-3 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
          {actionError}
        </div>
      )}
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

      {/* Mint a ready-to-use account to test another context. */}
      <div className="mt-10">
        <h2 className="text-sm font-semibold text-neutral-700 mb-1">Créer un compte de test</h2>
        <p className="text-xs text-neutral-500 mb-4 max-w-2xl">
          Le compte est créé immédiatement, email déjà confirmé. Le mot de passe s&apos;affiche une seule fois,
          juste après la création — copiez-le avant de quitter la page, il n&apos;est stocké nulle part.
        </p>

        <div className="bg-white rounded-2xl border border-neutral-200 p-5 sm:p-6 shadow-sm">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Email *</label>
              <input
                value={newEmail} onChange={e => setNewEmail(e.target.value)}
                placeholder="test-acme@exemple.com" type="email"
                className={adminInput}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Nom</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Jean Dupont" className={adminInput} />
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Rôle</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {(['director', 'sales'] as const).map(r => (
                  <button
                    key={r} type="button" onClick={() => setNewRole(r)}
                    className={`border rounded-xl px-3 py-2 text-sm font-medium transition-all ${newRole === r ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'}`}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Langue</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {(['fr', 'en'] as const).map(l => (
                  <button
                    key={l} type="button" onClick={() => setNewLocale(l)}
                    className={`border rounded-xl px-3 py-2 text-sm font-medium transition-all ${newLocale === l ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'}`}
                  >
                    {l === 'fr' ? 'Français' : 'English'}
                  </button>
                ))}
              </div>
            </div>

            {newRole === 'director' ? (
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Entreprise *</label>
                <input value={newCompany} onChange={e => setNewCompany(e.target.value)} placeholder="Acme" className={adminInput} />
                <p className="text-[11px] text-neutral-400 mt-1">Une organisation est créée, avec son propre Sales Playbook.</p>
              </div>
            ) : (
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Équipe à rejoindre *</label>
                <select value={newOrgId} onChange={e => setNewOrgId(e.target.value)} className={adminInput}>
                  <option value="">— Choisir une équipe —</option>
                  {(stats.organizations ?? []).map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-neutral-400 mt-1">Le commercial hérite du playbook de cette équipe, en lecture seule.</p>
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-neutral-600 cursor-pointer">
                <input type="checkbox" checked={skipOnboarding} onChange={e => setSkipOnboarding(e.target.checked)} className="rounded border-neutral-300" />
                Passer l&apos;onboarding (compte prêt à l&apos;emploi)
              </label>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-neutral-100 flex items-center gap-3 flex-wrap">
            <button
              onClick={handleCreateAccount}
              disabled={creating || !newEmail.trim() || (newRole === 'director' ? !newCompany.trim() : !newOrgId)}
              className="px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 disabled:opacity-40 transition-all"
            >
              {creating ? 'Création…' : 'Créer le compte'}
            </button>
            {createError && <span className="text-sm text-rose-600">{createError}</span>}
          </div>

          {created && (
            <div className="mt-5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-4">
              <p className="text-sm font-medium text-emerald-800 mb-2">Compte créé — copiez le mot de passe maintenant</p>
              <div className="font-mono text-sm text-emerald-900 bg-white border border-emerald-200 rounded-lg px-3 py-2 break-all">
                {created.email}<br />{created.password}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${created.email}\n${created.password}`)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="mt-2 text-sm font-medium text-emerald-700 hover:text-emerald-800"
              >
                {copied ? 'Copié !' : 'Copier'}
              </button>
              <p className="text-xs text-emerald-700/80 mt-2">
                Connectez-vous avec ces identifiants dans une fenêtre privée pour rester connecté ici en parallèle.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Auth identities with no account behind them. These hold the email
          address hostage: signup silently "succeeds" but nothing is created. */}
      {stats.orphans && stats.orphans.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-neutral-700 mb-1">
            Inscriptions incomplètes ({stats.orphans.length})
          </h2>
          <p className="text-xs text-neutral-500 mb-4 max-w-2xl">
            Comptes créés dans l&apos;authentification mais sans profil : onboarding jamais terminé, ou reliquat
            d&apos;une suppression partielle. Ils bloquent l&apos;adresse email — impossible de se réinscrire avec.
            Supprimez-les pour libérer l&apos;adresse.
          </p>
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/50 text-left text-xs font-medium text-neutral-400 uppercase tracking-wide">
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Email vérifié</th>
                  <th className="px-4 py-3">Créé le</th>
                  <th className="px-4 py-3">Dernière connexion</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stats.orphans.map(o => (
                  <tr key={o.userId} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-neutral-800">{o.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${o.confirmed ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                        {o.confirmed ? 'Vérifié' : 'Non vérifié'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{fmtDate(o.createdAt)}</td>
                    <td className="px-4 py-3 text-neutral-500">{fmtDate(o.lastSignIn)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {confirmId === o.userId ? (
                        <span className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleDelete(o.userId)}
                            disabled={deletingId === o.userId}
                            className="text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg px-2.5 py-1 disabled:opacity-40 transition-all"
                          >
                            {deletingId === o.userId ? 'Suppression…' : 'Confirmer'}
                          </button>
                          <button onClick={() => setConfirmId(null)} className="text-xs text-neutral-400 hover:text-neutral-600">Annuler</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmId(o.userId)} className="text-xs font-medium text-neutral-400 hover:text-rose-600 transition-colors">
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
      )}
    </div>
  )
}
