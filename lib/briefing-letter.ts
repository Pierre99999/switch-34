import type { DealRound, BriefingQuestion, BriefingObjection } from './types'

// The briefing as a letter rather than a form: the angle, the questions, the
// objections to expect, what not to do, and what winning this conversation
// looks like. Same content as the briefing page — one source, two renderings.

export function briefingToText(round: DealRound | null, prospectName: string): string {
  if (!round) return ''
  const q = (round.briefing_questions ?? []) as BriefingQuestion[]
  const pressing = q.filter(x => x.priority !== 'opportunistic')
  const opportunistic = q.filter(x => x.priority === 'opportunistic')
  const objections = (round.briefing_objections ?? []) as BriefingObjection[]
  const doNot = (round.briefing_do_not ?? []) as string[]

  const out: string[] = [`Briefing — ${prospectName}, round ${round.round}`, '']

  if (round.briefing_line) out.push(round.briefing_line, '')
  if (round.briefing_angle) out.push("L'ANGLE", round.briefing_angle, '')

  const renderQuestions = (title: string, list: BriefingQuestion[]) => {
    if (list.length === 0) return
    out.push(title)
    list.forEach((item, i) => {
      out.push(`${i + 1}. ${item.text}`)
      if (item.intent) out.push(`   Intention : ${item.intent}`)
      for (const sub of item.sub_questions ?? []) out.push(`   ↳ ${sub}`)
      out.push('')
    })
  }
  renderQuestions('LES QUESTIONS À POSER', pressing)
  renderQuestions('SI LA CONVERSATION S’OUVRE', opportunistic)

  if (objections.length > 0) {
    out.push('LES OBJECTIONS PROBABLES')
    for (const o of objections) {
      out.push(`• ${o.likely}`)
      if (o.frame) out.push(`  Réponse : ${o.frame}`)
    }
    out.push('')
  }

  if (doNot.length > 0) {
    out.push('À NE PAS FAIRE')
    for (const d of doNot) out.push(`• ${d}`)
    out.push('')
  }

  if (round.briefing_win_condition) {
    out.push('LA CONDITION DE VICTOIRE', round.briefing_win_condition)
  }

  return out.join('\n').trim()
}

/**
 * A shorter body for a mailto: link.
 *
 * mailto has a hard length limit in several clients — Windows caps the whole
 * URL around 2 000 characters and Outlook truncates silently. A full briefing
 * with sub-questions and framings goes past that, so this drops to the main
 * questions and the win condition. Copying gives the whole thing.
 */
export function briefingToMailBody(round: DealRound | null): string {
  if (!round) return ''
  const q = (round.briefing_questions ?? []) as BriefingQuestion[]
  const out: string[] = []
  if (round.briefing_angle) out.push("L'ANGLE", round.briefing_angle, '')
  if (q.length > 0) {
    out.push('LES QUESTIONS')
    q.filter(x => x.priority !== 'opportunistic').forEach((item, i) => out.push(`${i + 1}. ${item.text}`))
    out.push('')
  }
  if (round.briefing_win_condition) out.push('CONDITION DE VICTOIRE', round.briefing_win_condition)
  const body = out.join('\n').trim()
  return body.length > 1500 ? `${body.slice(0, 1500)}…` : body
}

export function briefingSubject(prospectName: string, round: number): string {
  return `Briefing — ${prospectName}, round ${round}`
}
