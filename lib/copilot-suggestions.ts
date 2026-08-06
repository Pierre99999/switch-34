// The four questions the copilot offers, chosen from the state of the deal.
//
// Deterministic on purpose: a seller opening a deal should see the questions
// they are about to ask, immediately and at no cost. Asking a model which
// questions to offer would add a call, a wait and a source of drift for
// something the diagnostic already knows.
//
// Ordered by what is most pressing. Three of the four change as the deal
// moves, which is the point: the same four questions on every deal would be a
// menu, not a copilot.
//
// The first one never changes, and that is deliberate. "What is it now
// important to understand?" is the question the method asks at every step —
// what matters to understand is not the same at round 1 and at round 4, and
// having it always in the same place makes it a reflex rather than something
// you think to ask when you already know the answer.

import type { DealRound } from './types'
import { criterionLabel } from './lab-view'
import { prescriptions, type DealState } from './scoring'
import { nextStep } from './deal-rounds'
import { normalizeFit, FIT_AXIS_LABELS, type PlaybookFit, type ActorCoverage } from './playbook-fit'
import { readGap, normalizeSellerRead } from './seller-read'
import type { Declaration } from './voice-credit'

export type Suggestion = {
  key: string
  label: string
  hint: string
  /** The full question sent to the copilot. */
  q: string
  tint: string
}

const TINT = {
  alarm: 'bg-rose-50 text-rose-500',
  gate: 'bg-emerald-50 text-emerald-500',
  people: 'bg-amber-50 text-amber-500',
  fit: 'bg-violet-50 text-violet-500',
  momentum: 'bg-blue-50 text-blue-500',
}

export type SuggestionInput = {
  deal: { current_round: number; status?: string | null; playbook_fit?: unknown }
  rounds: DealRound[]
  current: DealRound | null
  dealState: DealState
  coverage: ActorCoverage | null
}

export function copilotSuggestions(input: SuggestionInput): Suggestion[] {
  const { deal, rounds, current, dealState, coverage } = input
  const step = nextStep(deal as { current_round: number; status?: string | null }, rounds)
  const fit: PlaybookFit | null = normalizeFit(deal.playbook_fit)
  const gate = dealState.gates[dealState.activeGate]
  const presc = prescriptions(current)
  const gap = readGap(normalizeSellerRead((current as unknown as { seller_read?: unknown } | null)?.seller_read), current)
  const declarations = (current?.declarations ?? {}) as Record<string, Declaration[]>
  const against = Object.values(declarations).flat().filter(d => d.stance === 'contre').length

  const out: Suggestion[] = []
  const add = (s: Suggestion) => { if (!out.some(x => x.key === s.key)) out.push(s) }

  // 0. Always first, whatever the state of the deal.
  add({
    key: 'understand', tint: TINT.gate,
    label: 'Qu’est-ce qu’il est important de comprendre maintenant ?',
    hint: 'Ce que cette étape du deal demande d’éclaircir',
    q: 'À ce stade précis du deal, qu’est-ce qu’il est le plus important de comprendre — et pourquoi maintenant plutôt qu’avant ou plus tard ? Appuie-toi sur ce qui est établi, sur ce qui ne l’est pas, et sur ce qui a changé depuis la dernière conversation.',
  })

  // 1. Then, by urgency. Walking away is the cheapest decision available.
  if (fit?.avoid_list_hit) {
    add({
      key: 'avoid', tint: TINT.alarm,
      label: 'Faut-il continuer ce deal ?',
      hint: 'Il ressemble à un segment que vous avez décidé de fuir',
      q: 'Ce prospect ressemble à un segment que nous avons décidé de fuir. Qu’est-ce qui, dans ce qui a été dit, justifierait de faire exception — et qu’est-ce qui plaide pour partir ?',
    })
  }

  const negative = presc.find(p => p.kind === 'NEGATIF')
  if (negative) {
    add({
      key: `neg:${negative.variable}`, tint: TINT.alarm,
      label: `Faut-il partir sur ${criterionLabel(negative.variable).toLowerCase()} ?`,
      hint: 'Signal défavorable et corroboré',
      q: `Le critère "${criterionLabel(negative.variable)}" est défavorable et corroboré. Qui a dit quoi exactement, et est-ce un motif de quitter ce deal ou de le retourner ?`,
    })
  }

  // 2. What blocks the deal from moving at all.
  if (gate?.lockVariable) {
    add({
      key: 'lock', tint: TINT.gate,
      label: 'Pourquoi cette porte est-elle bloquée ?',
      hint: `${criterionLabel(gate.lockVariable)} sous le seuil`,
      q: `Quelle porte est bloquée, par quel critère exactement, et qu’est-ce qui la débloquerait concrètement lors du prochain échange ?`,
    })
  }

  // 3. A missing person is a fix, not a question to ask the prospect.
  const missing = coverage?.missing?.[0]
  if (missing) {
    add({
      key: `actor:${missing.label}`, tint: TINT.people,
      label: `Comment atteindre ${missing.label.toLowerCase()} ?`,
      hint: 'Rôle requis par votre playbook, absent du deal',
      q: `Votre playbook dit qu’un deal de ce type ne se signe pas sans "${missing.label}", et cette personne n’est pas dans la boucle. Comment ouvrir un chemin vers elle à partir de ce qui a déjà été dit ?`,
    })
  }

  // 4. Where the seller's read and the evidence disagree.
  if (gap && gap.kind !== 'aligned') {
    add({
      key: 'gap', tint: TINT.alarm,
      label: gap.kind === 'optimistic' ? 'Pourquoi les preuves sont-elles plus faibles ?' : 'Qu’est-ce que je ne vois pas ?',
      hint: gap.kind === 'optimistic' ? 'Votre ressenti dépasse ce qui est établi' : 'Les preuves dépassent votre ressenti',
      q: gap.kind === 'optimistic'
        ? 'Je sens ce deal mieux que les scores ne le montrent. Qu’est-ce qui est réellement établi, et qu’est-ce que je prends pour acquis sans preuve ?'
        : 'Les preuves semblent meilleures que mon ressenti. Qu’est-ce qui est solide dans ce deal, et qu’est-ce qui justifierait quand même ma réserve ?',
    })
  }

  if (against > 0) {
    add({
      key: 'contradiction', tint: TINT.alarm,
      label: 'Qui se contredit sur ce deal ?',
      hint: `${against} propos défavorable${against > 1 ? 's' : ''} relevé${against > 1 ? 's' : ''}`,
      q: 'Quelles déclarations se contredisent sur ce deal, entre quelles personnes, et sur quels critères ? Que faut-il arbitrer en priorité ?',
    })
  }

  // 5. Movement between rounds.
  if (dealState.momentum.stagnant || dealState.momentum.status === 'EN_PANNE') {
    add({
      key: 'momentum', tint: TINT.momentum,
      label: 'Pourquoi le momentum ne bouge-t-il pas ?',
      hint: dealState.momentum.stagnant ? 'Aucune progression sur trois captures' : 'Dynamique faible',
      q: 'Pourquoi le momentum est-il à ce niveau, qu’est-ce qui n’a pas bougé d’un round à l’autre, et quel signal montrerait que la décision se construit vraiment ?',
    })
  }

  // 6. The phase the deal is actually in.
  if (step.kind === 'capture') {
    add({
      key: 'capture', tint: TINT.gate,
      label: 'Que dois-je absolument obtenir ?',
      hint: 'La conversation est préparée mais pas encore capturée',
      q: 'Le briefing est prêt. Qu’est-ce que cette conversation doit absolument produire pour que le deal avance, et à quoi saurai-je qu’elle a échoué ?',
    })
  }
  if (rounds.length === 0 || !current) {
    add({
      key: 'start', tint: TINT.gate,
      label: 'Que sait-on déjà de ce prospect ?',
      hint: 'Avant le premier échange',
      q: 'Avant tout échange, que sait-on de ce prospect, d’où vient cette information, et qu’est-ce qui reste à vérifier en priorité ?',
    })
  }

  // 7. Blind spots and single voices.
  const missingCriterion = presc.find(p => p.kind === 'MANQUANT')
  if (missingCriterion) {
    const label = criterionLabel(missingCriterion.variable)
    add({
      key: `blind:${missingCriterion.variable}`, tint: TINT.gate,
      label: `Comment ouvrir ${label.toLowerCase()} ?`,
      hint: 'Zone aveugle — rien n’a été dit là-dessus',
      q: `Rien n’a encore été dit sur "${label}". Comment amener ce sujet naturellement dans la prochaine conversation, sans que ça sonne comme un interrogatoire ?`,
    })
  }

  const toCorroborate = presc.find(p => p.kind === 'CORROBORER')
  if (toCorroborate) {
    const label = criterionLabel(toCorroborate.variable)
    add({
      key: `corr:${toCorroborate.variable}`, tint: TINT.gate,
      label: `Qui peut confirmer ${label.toLowerCase()} ?`,
      hint: 'Une seule voix pour l’instant',
      q: `"${label}" ne repose que sur une voix. Qui d’autre pourrait le confirmer, et quel chiffre ou quel fait le transformerait en preuve ?`,
    })
  }

  // 8. The playbook reading.
  const offAxis = (fit?.axes ?? []).find(a => a.verdict === 'mismatch')
    ?? (fit?.axes ?? []).find(a => a.verdict === 'unknown')
  if (offAxis) {
    add({
      key: `fit:${offAxis.key}`, tint: TINT.fit,
      label: `${FIT_AXIS_LABELS[offAxis.key].fr} — où en est-on ?`,
      hint: offAxis.verdict === 'mismatch' ? 'Hors cadre par rapport au playbook' : 'Rien ne le dit pour l’instant',
      q: `Sur l’axe "${FIT_AXIS_LABELS[offAxis.key].fr}", ce prospect ne correspond pas encore à notre playbook. Qu’est-ce qui manque pour trancher, et comment l’obtenir ?`,
    })
  }

  // 9. Always available, so there are four even on a healthy deal.
  add({
    key: 'evidence', tint: TINT.gate,
    label: 'Que sait-on vraiment, et sur quelle preuve ?',
    hint: 'Ce qui est corroboré, ce qui n’est que déclaré',
    q: 'Résume ce qui est établi sur ce deal en distinguant ce qui est corroboré de ce qui n’est que déclaré, et par qui.',
  })
  add({
    key: 'voices', tint: TINT.people,
    label: 'Qui a parlé, et avec quel poids ?',
    hint: 'Les voix entendues et celles qui manquent',
    q: 'Qui s’est exprimé sur ce deal, quel poids a chaque voix selon son rôle, et de qui n’avons-nous rien entendu ?',
  })
  add({
    key: 'assumption', tint: TINT.alarm,
    label: 'Qu’est-ce que je tiens pour acquis sans preuve ?',
    hint: 'Ce que je crois savoir et que personne n’a dit',
    q: 'Sur ce deal, qu’est-ce qui est traité comme acquis alors que rien dans les conversations ne l’établit ? Distingue ce que le prospect a dit de ce que nous avons supposé à sa place.',
  })
  add({
    key: 'premortem', tint: TINT.alarm,
    label: 'Si je perds ce deal, ce sera pourquoi ?',
    hint: 'La cause la plus probable, nommée à l’avance',
    q: 'Imaginons ce deal perdu dans trois mois. D’après ce qui est établi aujourd’hui, quelle en serait la cause la plus probable, et qu’est-ce qui pourrait encore l’éviter ?',
  })
  add({
    key: 'risk', tint: TINT.alarm,
    label: 'Quel est le vrai risque sur ce deal ?',
    hint: 'Ce qui le ferait échouer',
    q: 'Quel est le risque le plus sérieux sur ce deal aujourd’hui, d’après le diagnostic, et qu’est-ce qui le réduirait ?',
  })

  return out.slice(0, 4)
}
