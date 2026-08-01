// The Sales Playbook — Part A of the Switch playbook, "le socle".
//
// What the company knows about itself: filled once, revised slowly, and the
// same for every deal. Everything past "la bascule" (Part B, the deal grid)
// deliberately lives elsewhere — it belongs to a deal, never to the playbook.
//
// Unlike the 9-dimension profile this replaces, the socle is made of tables
// with a variable number of rows, not flat text fields.

export type PlaybookRow = Record<string, string>

export type Playbook = {
  a1_value_proposition: PlaybookRow[]
  a2_ideal_targets: PlaybookRow[]
  a2_avoid_targets: PlaybookRow[]
  a3_positioning: PlaybookRow[]
  a4_perception: PlaybookRow[]
  a5_actors: PlaybookRow[]
  a6_questions: PlaybookRow[]
  a6_hypotheses: string
  a7_postmortem: PlaybookRow[]
}

export type PlaybookTableKey = Exclude<keyof Playbook, 'a6_hypotheses'>

export const PLAYBOOK_TABLES: PlaybookTableKey[] = [
  'a1_value_proposition', 'a2_ideal_targets', 'a2_avoid_targets', 'a3_positioning',
  'a4_perception', 'a5_actors', 'a6_questions', 'a7_postmortem',
]

// A3 always compares the same three alternatives — the status quo first,
// because it is the real competitor.
const SEEDED_POSITIONING = (locale: string): PlaybookRow[] => ([
  { alternative: locale === 'fr' ? 'Le statu quo (ne rien faire)' : 'The status quo (doing nothing)', promise: '', difference: '', proof: '' },
  { alternative: locale === 'fr' ? 'La solution interne' : 'The in-house solution', promise: '', difference: '', proof: '' },
  { alternative: locale === 'fr' ? 'Concurrent 1' : 'Competitor 1', promise: '', difference: '', proof: '' },
])

// A6 is organised by family, never as a recited list.
const SEEDED_QUESTIONS = (locale: string): PlaybookRow[] => ([
  { family: locale === 'fr' ? 'Ouvrir' : 'Open', questions: '' },
  { family: locale === 'fr' ? 'Creuser' : 'Dig' , questions: '' },
  { family: locale === 'fr' ? 'Challenger' : 'Challenge', questions: '' },
  { family: locale === 'fr' ? 'Valider' : 'Validate', questions: '' },
])

export function emptyPlaybook(locale = 'fr'): Playbook {
  return {
    a1_value_proposition: [],
    a2_ideal_targets: [],
    a2_avoid_targets: [],
    a3_positioning: SEEDED_POSITIONING(locale),
    a4_perception: [],
    a5_actors: [],
    a6_questions: SEEDED_QUESTIONS(locale),
    a6_hypotheses: '',
    a7_postmortem: [],
  }
}

// Tolerates partial or absent data from the database.
export function normalizePlaybook(raw: unknown, locale = 'fr'): Playbook {
  const base = emptyPlaybook(locale)
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<Playbook>
  const rows = (v: unknown): PlaybookRow[] =>
    Array.isArray(v) ? v.filter(x => x && typeof x === 'object') as PlaybookRow[] : []
  const out: Playbook = { ...base }
  for (const k of PLAYBOOK_TABLES) {
    const got = rows(r[k])
    if (got.length) out[k] = got
  }
  if (typeof r.a6_hypotheses === 'string') out.a6_hypotheses = r.a6_hypotheses
  return out
}

export function rowHasContent(row: PlaybookRow): boolean {
  return Object.values(row).some(v => typeof v === 'string' && v.trim().length > 0)
}

export function filledRowCount(rows: PlaybookRow[]): number {
  return rows.filter(rowHasContent).length
}

// ── Section definitions ──────────────────────────────────────

export type PlaybookColumn = { key: string; label: string; hint?: string; wide?: boolean }

export type PlaybookSection = {
  key: PlaybookTableKey
  code: string          // "A1"
  label: string
  produces: string      // "Ce que cette grille produit — …"
  intro: string         // the paragraph of method
  columns: PlaybookColumn[]
  addLabel: string
  // A2 renders two tables side by side; the second one names its partner.
  pairedWith?: PlaybookTableKey
  // A6 carries a free-text field under the table.
  extraTextKey?: 'a6_hypotheses'
  extraTextLabel?: string
}

const SECTIONS_FR: PlaybookSection[] = [
  {
    key: 'a1_value_proposition', code: 'A1', label: 'La proposition de valeur, par segment',
    produces: 'La définition claire de qui vous ciblez, pour résoudre quel problème, et pourquoi vous gagnez.',
    intro: "Votre proposition de valeur est votre terrain de jeu. Ce n'est pas une description de produit : c'est la transformation que vous créez, formulée en conséquence pour le client, avec sa preuve.",
    columns: [
      { key: 'segment', label: 'Segment / type de client' },
      { key: 'problem', label: 'Problème que vous résolvez', wide: true },
      { key: 'consequence', label: 'Conséquence concrète pour eux', wide: true },
      { key: 'proof', label: 'Preuve' },
    ],
    addLabel: '+ Ajouter un segment',
  },
  {
    key: 'a2_ideal_targets', code: 'A2', label: 'Le terrain de jeu — cibles idéales, cibles à fuir',
    produces: 'La carte des endroits où vous pêchez — et de ceux où vous ne lancez plus jamais votre ligne.',
    intro: 'Les meilleures opportunités ressemblent aux deals que vous avez déjà bien gagnés. Vos deals les plus faciles révèlent votre zone de domination ; vos deals lents, perdus ou non rentables dessinent la liste des cibles à fuir.',
    columns: [{ key: 'target', label: 'Cibles idéales (vous gagnez souvent, vite, bien)', wide: true }],
    addLabel: '+ Ajouter une cible idéale',
    pairedWith: 'a2_avoid_targets',
  },
  {
    key: 'a3_positioning', code: 'A3', label: 'Le positionnement — pourquoi nous',
    produces: 'La différence pertinente qui crée la mémoire, et la préférence, face à chaque alternative.',
    intro: "Le positionnement ne consiste pas à être meilleur, mais à être différent d'une manière pertinente. Le client compare toujours à trois alternatives : un concurrent, une solution interne, et le statu quo — votre vrai concurrent.",
    columns: [
      { key: 'alternative', label: 'Alternative' },
      { key: 'promise', label: 'Ce qu’elle promet', wide: true },
      { key: 'difference', label: 'Notre différence pertinente', wide: true },
      { key: 'proof', label: 'Preuve' },
    ],
    addLabel: '+ Ajouter une alternative',
  },
  {
    key: 'a4_perception', code: 'A4', label: 'La perception — comment le marché nous voit',
    produces: "Les objections de perception connues d'avance, et la manière de les désamorcer d'emblée.",
    intro: "Avant le premier mot, le prospect a déjà une opinion sur vous : taille, prix, réputation, pays, références. Les objections les plus lourdes sont déjà là avant la première réunion — on désamorce toujours mieux l'objection que l'on a nommée soi-même que celle qui couve en silence.",
    columns: [
      { key: 'objection', label: 'Objection de perception probable', wide: true },
      { key: 'prospect_type', label: 'Chez quel type de prospect' },
      { key: 'defuse', label: "Comment la nommer et la désamorcer d'emblée", wide: true },
    ],
    addLabel: '+ Ajouter une objection',
  },
  {
    key: 'a5_actors', code: 'A5', label: 'Les acteurs nécessaires',
    produces: "Les rôles sans lesquels, d'après vos deals passés, un deal de ce type ne se signe jamais.",
    intro: "Ce ne sont pas les acteurs d'un deal précis — ceux-là se découvrent dans la grille de deal. Ce sont les rôles structurels : champion, utilisateur, acheteur technique, décideur, gardien du budget, bloqueur probable — et ce que votre histoire vous a appris sur chacun.",
    columns: [
      { key: 'role', label: 'Rôle nécessaire' },
      { key: 'why', label: 'Pourquoi il est indispensable (d’après vos deals passés)', wide: true },
      { key: 'risk', label: "Risque si le deal avance sans lui", wide: true },
    ],
    addLabel: '+ Ajouter un rôle',
  },
  {
    key: 'a6_questions', code: 'A6', label: 'Le questionnaire invisible',
    produces: 'La logique de questions que chaque vendeur garde en tête — jamais une liste récitée.',
    intro: "Quelques questions qui changent la qualité d'une décision valent mieux que cent questions que personne n'utilise. Organisez-les par famille, et notez les hypothèses que chaque deal devra vérifier en priorité.",
    columns: [
      { key: 'family', label: 'Famille' },
      { key: 'questions', label: 'Vos questions clés', wide: true },
    ],
    addLabel: '+ Ajouter une famille',
    extraTextKey: 'a6_hypotheses',
    extraTextLabel: 'Hypothèses à vérifier en priorité',
  },
  {
    key: 'a7_postmortem', code: 'A7', label: 'Le post-mortem — la boucle qui nourrit le socle',
    produces: 'La mémoire des deals gagnés et perdus — la matière première de toutes les grilles ci-dessus.',
    intro: "Le socle n'est pas figé : il se nourrit ici. Chaque deal clos — gagné, perdu ou quitté — laisse une ligne. Quand plusieurs lignes se ressemblent, ce n'est jamais un hasard : c'est un segment qui entre en A2, une différence qui entre en A3, une objection qui entre en A4.",
    columns: [
      { key: 'deal', label: 'Deal' },
      { key: 'outcome', label: 'Gagné / Perdu / Quitté' },
      { key: 'why', label: 'Pourquoi, vraiment', wide: true },
      { key: 'signal', label: 'Signal précoce (vu, ou manqué)', wide: true },
    ],
    addLabel: '+ Ajouter un deal clos',
  },
]

const SECTIONS_EN: PlaybookSection[] = [
  {
    key: 'a1_value_proposition', code: 'A1', label: 'The value proposition, by segment',
    produces: 'A clear definition of who you target, which problem you solve, and why you win.',
    intro: 'Your value proposition is your playing field. It is not a product description: it is the transformation you create, stated as a consequence for the customer, with its proof.',
    columns: [
      { key: 'segment', label: 'Segment / customer type' },
      { key: 'problem', label: 'Problem you solve', wide: true },
      { key: 'consequence', label: 'Concrete consequence for them', wide: true },
      { key: 'proof', label: 'Proof' },
    ],
    addLabel: '+ Add a segment',
  },
  {
    key: 'a2_ideal_targets', code: 'A2', label: 'The playing field — ideal targets, targets to avoid',
    produces: 'A map of where you fish — and where you never cast a line again.',
    intro: 'The best opportunities look like the deals you have already won well. Your easiest deals reveal your zone of dominance; your slow, lost or unprofitable deals draw the list of targets to avoid.',
    columns: [{ key: 'target', label: 'Ideal targets (you win often, fast, well)', wide: true }],
    addLabel: '+ Add an ideal target',
    pairedWith: 'a2_avoid_targets',
  },
  {
    key: 'a3_positioning', code: 'A3', label: 'Positioning — why us',
    produces: 'The relevant difference that creates memory, and preference, against each alternative.',
    intro: 'Positioning is not about being better, but about being different in a relevant way. The customer always compares against three alternatives: a competitor, an in-house solution, and the status quo — your real competitor.',
    columns: [
      { key: 'alternative', label: 'Alternative' },
      { key: 'promise', label: 'What it promises', wide: true },
      { key: 'difference', label: 'Our relevant difference', wide: true },
      { key: 'proof', label: 'Proof' },
    ],
    addLabel: '+ Add an alternative',
  },
  {
    key: 'a4_perception', code: 'A4', label: 'Perception — how the market sees us',
    produces: 'The perception objections known in advance, and how to defuse them upfront.',
    intro: 'Before the first word, the prospect already has an opinion about you: size, price, reputation, country, references. The heaviest objections are there before the first meeting — an objection you name yourself is always easier to defuse than one that smoulders in silence.',
    columns: [
      { key: 'objection', label: 'Likely perception objection', wide: true },
      { key: 'prospect_type', label: 'With which type of prospect' },
      { key: 'defuse', label: 'How to name it and defuse it upfront', wide: true },
    ],
    addLabel: '+ Add an objection',
  },
  {
    key: 'a5_actors', code: 'A5', label: 'The necessary actors',
    produces: 'The roles without which, based on your past deals, a deal of this kind never closes.',
    intro: 'These are not the actors of one specific deal — those are discovered in the deal grid. These are the structural roles: champion, user, technical buyer, decision maker, budget guardian, likely blocker — and what your history taught you about each.',
    columns: [
      { key: 'role', label: 'Necessary role' },
      { key: 'why', label: 'Why they are indispensable (from past deals)', wide: true },
      { key: 'risk', label: 'Risk if the deal moves without them', wide: true },
    ],
    addLabel: '+ Add a role',
  },
  {
    key: 'a6_questions', code: 'A6', label: 'The invisible questionnaire',
    produces: 'The question logic every seller keeps in mind — never a recited list.',
    intro: 'A few questions that change the quality of a decision beat a hundred questions nobody uses. Organise them by family, and note the assumptions each deal must verify first.',
    columns: [
      { key: 'family', label: 'Family' },
      { key: 'questions', label: 'Your key questions', wide: true },
    ],
    addLabel: '+ Add a family',
    extraTextKey: 'a6_hypotheses',
    extraTextLabel: 'Assumptions to verify first',
  },
  {
    key: 'a7_postmortem', code: 'A7', label: 'The post-mortem — the loop that feeds the socle',
    produces: 'The memory of deals won and lost — the raw material of every grid above.',
    intro: 'The socle is not fixed: this is where it feeds. Every closed deal — won, lost or walked away from — leaves a line. When several lines look alike, it is never a coincidence: it is a segment entering A2, a difference entering A3, an objection entering A4.',
    columns: [
      { key: 'deal', label: 'Deal' },
      { key: 'outcome', label: 'Won / Lost / Walked away' },
      { key: 'why', label: 'Why, really', wide: true },
      { key: 'signal', label: 'Early signal (seen, or missed)', wide: true },
    ],
    addLabel: '+ Add a closed deal',
  },
]

export function getPlaybookSections(locale: string): PlaybookSection[] {
  return locale === 'fr' ? SECTIONS_FR : SECTIONS_EN
}

// The second column of A2, which has no section of its own.
export function avoidTargetsColumn(locale: string): PlaybookColumn {
  return locale === 'fr'
    ? { key: 'target', label: 'Cibles à fuir (deals lents, perdus, non rentables)', wide: true }
    : { key: 'target', label: 'Targets to avoid (slow, lost, unprofitable deals)', wide: true }
}

// ── Completion ───────────────────────────────────────────────

// A section counts as started as soon as one row holds something.
export function playbookProgress(pb: Playbook, locale: string): { started: number; total: number } {
  const sections = getPlaybookSections(locale)
  const started = sections.filter(s => {
    if (s.key === 'a2_ideal_targets') {
      return filledRowCount(pb.a2_ideal_targets) > 0 || filledRowCount(pb.a2_avoid_targets) > 0
    }
    if (s.key === 'a6_questions') {
      return filledRowCount(pb.a6_questions) > 0 || pb.a6_hypotheses.trim().length > 0
    }
    return filledRowCount(pb[s.key]) > 0
  }).length
  return { started, total: sections.length }
}

// The exit criterion of Part A, quoted from the playbook.
export function exitCriterion(locale: string): string {
  return locale === 'fr'
    ? "Vous savez décrire en une phrase à qui vous vendez, pour résoudre quel problème, avec quelle preuve — et chaque vendeur de l'équipe sait le faire aussi. Le socle est prêt ; les deals peuvent commencer."
    : 'You can describe in one sentence who you sell to, which problem you solve, and with what proof — and every seller on the team can too. The socle is ready; deals can begin.'
}

export function usageRules(locale: string): string[] {
  return locale === 'fr'
    ? [
      "Il appartient à l'équipe, pas à un deal : aucune donnée d'opportunité n'y entre.",
      'Il se remplit une fois, collectivement, et se relit à chaque onboarding.',
      'Il se révise à rythme lent : après chaque post-mortem marquant, ou en revue trimestrielle.',
      "Chaque vendeur doit pouvoir le restituer de mémoire : s'il est trop long pour cela, il est trop long.",
    ]
    : [
      'It belongs to the team, not to a deal: no opportunity data goes in.',
      'It is filled once, collectively, and re-read at every onboarding.',
      'It is revised slowly: after each notable post-mortem, or at a quarterly review.',
      'Every seller must be able to recall it from memory: if it is too long for that, it is too long.',
    ]
}

// ── AI context ───────────────────────────────────────────────

// Feed the socle to the briefing and scoring engines. Only rows with content.
export function playbookToContext(pb: Playbook, locale = 'fr'): string {
  const sections = getPlaybookSections(locale)
  const lines: string[] = []

  for (const s of sections) {
    const render = (rows: PlaybookRow[], cols: PlaybookColumn[], title: string) => {
      const filled = rows.filter(rowHasContent)
      if (!filled.length) return
      lines.push(`\n${title}:`)
      for (const row of filled) {
        const parts = cols.map(c => row[c.key]?.trim()).filter(Boolean)
        if (parts.length) lines.push(`  - ${parts.join(' | ')}`)
      }
    }
    render(pb[s.key], s.columns, `${s.code} ${s.label}`)
    if (s.pairedWith) render(pb[s.pairedWith], [avoidTargetsColumn(locale)], `${s.code} ${avoidTargetsColumn(locale).label}`)
    if (s.extraTextKey && pb.a6_hypotheses.trim()) {
      lines.push(`  ${s.extraTextLabel}: ${pb.a6_hypotheses.trim()}`)
    }
  }

  return lines.length ? `SALES PLAYBOOK (the seller's socle — same for every deal):${lines.join('\n')}` : ''
}
