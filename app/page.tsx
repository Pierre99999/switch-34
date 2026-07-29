import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Marketing landing for logged-out visitors. Authenticated users go
// straight to their pipeline.
export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/pipeline')

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Nav */}
      <nav className="border-b border-neutral-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="text-lg font-bold text-blue-500 tracking-tight">Switch</span>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors">
              Connexion
            </Link>
            <Link href="/signup" className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 transition-all">
              Essai gratuit
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-16 text-center">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-4">La méthode Switch, appliquée à chaque conversation</p>
        <h1 className="text-4xl sm:text-5xl font-bold text-neutral-900 leading-tight mb-5">
          La vérité sur vos deals.
        </h1>
        <p className="text-lg text-neutral-600 max-w-2xl mx-auto mb-8 leading-relaxed">
          Votre CRM enregistre ce que vos vendeurs déclarent. Switch diagnostique ce qui est réel :
          les preuves plafonnent les scores, les portes ne se franchissent pas à l&apos;optimisme,
          et chaque conversation prépare la suivante.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/signup" className="px-6 py-3 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 transition-all">
            Commencer — 14 jours gratuits
          </Link>
          <a href="#methode" className="px-6 py-3 bg-white text-neutral-700 text-sm font-medium rounded-xl border border-neutral-200 hover:border-neutral-400 transition-all">
            Découvrir la méthode
          </a>
        </div>
      </section>

      {/* The enemy */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
        <div className="bg-neutral-900 rounded-2xl p-8 sm:p-10 text-center">
          <p className="text-neutral-400 text-sm uppercase tracking-widest font-semibold mb-3">Le vrai problème</p>
          <p className="text-white text-xl sm:text-2xl font-semibold leading-snug max-w-2xl mx-auto">
            Des mois d&apos;activité sur des deals sans urgence, sans douleur, sans décideur.
            L&apos;activité n&apos;est pas de la progression.
          </p>
        </div>
      </section>

      {/* 3 benefits */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <div className="grid md:grid-cols-3 gap-5">
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl mb-4">🎯</div>
            <h3 className="text-base font-semibold text-neutral-900 mb-2">Pour le directeur commercial</h3>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Un pipeline fondé sur des preuves, pas sur du déclaratif. Trois portes séquentielles,
              un momentum surveillé en continu : vous savez quels deals sont réels — et lesquels
              méritent une sortie propre.
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-xl mb-4">🧭</div>
            <h3 className="text-base font-semibold text-neutral-900 mb-2">Pour le vendeur</h3>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Avant chaque rendez-vous : un briefing avec les questions qui comptent. Après :
              un diagnostic honnête et la prochaine étape. Vous savez toujours où appuyer —
              et quand arrêter.
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-xl mb-4">📖</div>
            <h3 className="text-base font-semibold text-neutral-900 mb-2">Une méthode, pas un gadget IA</h3>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Switch incarne la méthode du livre <em>Pourquoi les meilleurs vendeurs ne vendent pas</em> :
              crédit de voix, plafonds de preuve, portes, momentum. L&apos;IA applique la méthode —
              elle ne l&apos;invente pas.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="methode" className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
        <h2 className="text-2xl font-bold text-neutral-900 text-center mb-8">Le cycle Switch</h2>
        <div className="space-y-3">
          {[
            ['1', 'Contexte', 'L’IA construit le profil du prospect depuis son site et vos notes — et vos contacts sont qualifiés par rôle : décideur, champion, bloqueur…'],
            ['2', 'Briefing', 'Avant la conversation : les 4 questions pressantes de la porte active, les objections probables, l’angle.'],
            ['3', 'Conversation', 'Mode « En appel » pour ne rien oublier, puis capture des réponses — ou import du transcript.'],
            ['4', 'Diagnostic', 'Chaque critère est scoré selon qui a parlé et avec quelles preuves. Le déclaratif plafonne à 2,5/5 — impossible de se raconter des histoires.'],
            ['5', 'Lecture', 'Où en est vraiment le deal, ce qui bloque la porte suivante, et ce qu’il faut obtenir au prochain round.'],
          ].map(([n, title, desc]) => (
            <div key={n} className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm flex items-start gap-4">
              <span className="w-8 h-8 rounded-full bg-blue-500 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">{n}</span>
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
                <p className="text-sm text-neutral-600 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
        <h2 className="text-2xl font-bold text-neutral-900 text-center mb-2">Un prix par vendeur, tout compris</h2>
        <p className="text-sm text-neutral-500 text-center mb-8">Briefings, diagnostics et lectures IA inclus. Sans engagement.</p>
        <div className="grid md:grid-cols-3 gap-5">
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-1">Solo</h3>
            <div className="text-3xl font-bold text-neutral-900 mb-1">49 €<span className="text-sm font-normal text-neutral-400"> /mois</span></div>
            <p className="text-xs text-neutral-500 mb-4">Pour l&apos;indépendant ou le fondateur qui vend.</p>
            <ul className="text-sm text-neutral-600 space-y-2">
              <li>✓ Deals illimités</li>
              <li>✓ Briefings &amp; diagnostics IA</li>
              <li>✓ Méthode Switch complète</li>
            </ul>
          </div>
          <div className="bg-white rounded-2xl border-2 border-blue-500 p-6 shadow-md relative">
            <span className="absolute -top-3 left-6 bg-blue-500 text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">Recommandé</span>
            <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-1">Équipe</h3>
            <div className="text-3xl font-bold text-neutral-900 mb-1">89 €<span className="text-sm font-normal text-neutral-400"> /vendeur/mois</span></div>
            <p className="text-xs text-neutral-500 mb-4">Pour les équipes pilotées par un directeur commercial.</p>
            <ul className="text-sm text-neutral-600 space-y-2">
              <li>✓ Tout Solo</li>
              <li>✓ Vue directeur sur tout le pipeline</li>
              <li>✓ Questions obligatoires d&apos;équipe</li>
              <li>✓ Profil entreprise partagé</li>
            </ul>
          </div>
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-1">Entreprise</h3>
            <div className="text-3xl font-bold text-neutral-900 mb-1">Sur devis</div>
            <p className="text-xs text-neutral-500 mb-4">Grandes équipes, déploiement accompagné.</p>
            <ul className="text-sm text-neutral-600 space-y-2">
              <li>✓ Tout Équipe</li>
              <li>✓ Playbooks &amp; pondérations sur mesure</li>
              <li>✓ Formation à la méthode Switch</li>
            </ul>
          </div>
        </div>
        <div className="text-center mt-10">
          <Link href="/signup" className="inline-block px-8 py-3.5 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 transition-all">
            Savoir quels deals sont réels →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-sm text-neutral-400 text-center">Switch — d&apos;après <em>Pourquoi les meilleurs vendeurs ne vendent pas</em>, de Pierre Gaubil</span>
          <div className="flex gap-4 text-sm text-neutral-400">
            <Link href="/login" className="hover:text-neutral-700 transition-colors">Connexion</Link>
            <Link href="/signup" className="hover:text-neutral-700 transition-colors">Essai gratuit</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
