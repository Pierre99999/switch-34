'use client'

import { useRouter } from 'next/navigation'

// Shown on the pipeline while the Sales Playbook is still empty. The playbook
// is what every later reading is measured against — a deal is scored against
// the socle, and an empty socle makes the diagnostic generic. So the first
// thing a new director is asked to do is build it, not open a deal.
export default function PlaybookWelcome({
  locale, onDismiss,
}: {
  locale: string
  onDismiss: () => void
}) {
  const router = useRouter()
  const fr = locale === 'fr'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="playbook-welcome-title"
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-neutral-200 p-6 sm:p-8">
        <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
          <span className="text-xl">📘</span>
        </div>

        <h2 id="playbook-welcome-title" className="text-xl font-bold text-neutral-900 mb-3">
          {fr ? 'Commençons par votre Sales Playbook' : 'Let us start with your Sales Playbook'}
        </h2>

        <div className="space-y-3 text-sm text-neutral-600 leading-relaxed">
          <p>
            {fr
              ? 'À partir de votre site ou de vos documents, nous allons créer un premier Sales Playbook : ce qui fait que vous vendez — ou pas, et bien ou moins bien.'
              : 'From your website or your documents, we will build a first Sales Playbook: what makes you win — or not, and well or less well.'}
          </p>
          <p>
            {fr
              ? 'C’est votre socle : à qui vous vendez, quel problème vous résolvez, face à quelles alternatives. Chaque deal sera ensuite lu à sa lumière — sans lui, le diagnostic reste générique.'
              : 'This is your socle: who you sell to, which problem you solve, against which alternatives. Every deal is then read against it — without it, the diagnostic stays generic.'}
          </p>
          <p className="text-neutral-500">
            {fr
              ? 'Comptez quelques minutes. Vous pourrez le compléter et le corriger à tout moment.'
              : 'It takes a few minutes. You can complete and correct it at any time.'}
          </p>
        </div>

        <button
          onClick={() => router.push('/playbook')}
          className="w-full mt-6 bg-blue-500 text-white py-3 text-sm font-semibold rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 transition-all"
          autoFocus
        >
          {fr ? 'Créer mon Sales Playbook →' : 'Build my Sales Playbook →'}
        </button>
        <button
          onClick={onDismiss}
          className="w-full mt-2 text-sm text-neutral-400 hover:text-neutral-600 transition-colors py-1"
        >
          {fr ? 'Plus tard' : 'Later'}
        </button>
      </div>
    </div>
  )
}
