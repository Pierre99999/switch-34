export type Locale = 'fr' | 'en'

export const translations = {
  // ── Nav ──
  'nav.pipeline': { en: 'Pipeline', fr: 'Pipeline' },
  'nav.profile': { en: 'My Profile', fr: 'Mon Profil' },
  'nav.dashboard': { en: 'Dashboard', fr: 'Tableau de bord' },
  'nav.briefing': { en: 'Briefing', fr: 'Briefing' },
  'nav.capture': { en: 'Capture', fr: 'Capture' },
  'nav.context': { en: 'Context', fr: 'Contexte' },
  'nav.boxes': { en: 'Boxes', fr: 'Boîtes' },
  'nav.signOut': { en: 'Sign out', fr: 'Déconnexion' },

  // ── Auth ──
  'auth.login': { en: 'Sign in', fr: 'Connexion' },
  'auth.signup': { en: 'Create account', fr: 'Créer un compte' },
  'auth.email': { en: 'Email', fr: 'Email' },
  'auth.password': { en: 'Password', fr: 'Mot de passe' },
  'auth.signingIn': { en: 'Signing in…', fr: 'Connexion…' },
  'auth.creatingAccount': { en: 'Creating account…', fr: 'Création…' },
  'auth.noAccount': { en: "Don't have an account?", fr: "Pas de compte ?" },
  'auth.hasAccount': { en: 'Already have an account?', fr: 'Déjà un compte ?' },
  'auth.signUpLink': { en: 'Sign up', fr: "S'inscrire" },
  'auth.signInLink': { en: 'Sign in', fr: 'Se connecter' },

  // ── Onboarding ──
  'onboarding.title': { en: 'Welcome', fr: 'Bienvenue' },
  'onboarding.subtitle': { en: 'Enter your company name to get started. We\'ll build your sales intelligence profile from there.', fr: 'Entrez le nom de votre entreprise pour commencer. Nous construirons votre profil commercial à partir de là.' },
  'onboarding.companyName': { en: 'Company name', fr: "Nom de l'entreprise" },
  'onboarding.companyNamePlaceholder': { en: 'Acme Corp', fr: 'Acme Corp' },
  'onboarding.website': { en: 'Website (optional)', fr: 'Site web (optionnel)' },
  'onboarding.websitePlaceholder': { en: 'acme.com', fr: 'acme.com' },
  'onboarding.submit': { en: 'Get started →', fr: 'Commencer →' },
  'onboarding.saving': { en: 'Setting up…', fr: 'Configuration…' },

  // ── Pipeline ──
  'pipeline.title': { en: 'Active deals', fr: 'Deals actifs' },
  'pipeline.newDeal': { en: '+ new deal', fr: '+ nouveau deal' },
  'pipeline.active': { en: 'Active', fr: 'Actifs' },
  'pipeline.nearClose': { en: 'Near Close', fr: 'Proche' },
  'pipeline.atRisk': { en: 'At Risk', fr: 'À risque' },
  'pipeline.new': { en: 'New', fr: 'Nouveau' },
  'pipeline.prospect': { en: 'Prospect', fr: 'Prospect' },
  'pipeline.round': { en: 'Round', fr: 'Round' },
  'pipeline.activity': { en: 'Activity', fr: 'Activité' },
  'pipeline.actions': { en: 'Actions', fr: 'Actions' },
  'pipeline.dashboard': { en: 'dashboard →', fr: 'tableau de bord →' },
  'pipeline.contextLink': { en: 'context →', fr: 'contexte →' },
  'pipeline.noDeals': { en: 'No deals yet', fr: 'Aucun deal' },
  'pipeline.noDealsDesc': { en: 'Start your first deal diagnostic to get going.', fr: 'Lancez votre premier diagnostic pour commencer.' },

  // ── New Deal ──
  'newDeal.title': { en: 'Start a deal diagnostic', fr: 'Démarrer un diagnostic' },
  'newDeal.subtitle': { en: 'Name the prospect and contact. Add context and URLs from the account context tab.', fr: 'Nommez le prospect et le contact. Ajoutez le contexte depuis l\'onglet contexte.' },
  'newDeal.prospectCompany': { en: 'Prospect company', fr: 'Entreprise prospect' },
  'newDeal.prospectPlaceholder': { en: 'Acme Manufacturing', fr: 'Acme Manufacturing' },
  'newDeal.contactName': { en: 'Contact name', fr: 'Nom du contact' },
  'newDeal.contactTitle': { en: 'Title', fr: 'Titre' },
  'newDeal.create': { en: 'Start diagnostic →', fr: 'Démarrer le diagnostic →' },
  'newDeal.creating': { en: 'Creating…', fr: 'Création…' },

  // ── Dashboard ──
  'dashboard.title': { en: 'Dashboard', fr: 'Tableau de bord' },
  'dashboard.round': { en: 'Round', fr: 'Round' },
  'dashboard.initial': { en: 'initial', fr: 'initial' },
  'dashboard.view': { en: 'View:', fr: 'Vue :' },
  'dashboard.accountContext': { en: 'account context →', fr: 'contexte compte →' },
  'dashboard.engineRead': { en: 'Engine Read', fr: 'Lecture moteur' },
  'dashboard.verdict': { en: 'Verdict', fr: 'Verdict' },
  'dashboard.active': { en: 'Active', fr: 'Actif' },
  'dashboard.generateBriefing': { en: 'Generate Round {n} Briefing →', fr: 'Générer le briefing Round {n} →' },
  'dashboard.generating': { en: 'Generating…', fr: 'Génération…' },
  'dashboard.nextRound': { en: '+ Next Round', fr: '+ Round suivant' },
  'dashboard.engineNarrative': { en: 'Engine narrative', fr: 'Narrative moteur' },
  'dashboard.backToPipeline': { en: '← pipeline', fr: '← pipeline' },

  // ── Layer labels ──
  'layer.1': { en: 'Opportunity', fr: 'Opportunité' },
  'layer.2': { en: 'Winability', fr: 'Gagnabilité' },
  'layer.3': { en: 'Impact', fr: 'Impact' },
  'layer.4': { en: 'Momentum', fr: 'Momentum' },
  'layer.q1': { en: 'Stay or disengage?', fr: 'Rester ou se désengager ?' },
  'layer.q2': { en: 'Are we positioned to win?', fr: 'Sommes-nous positionnés pour gagner ?' },
  'layer.q3': { en: 'Can we create meaningful outcomes?', fr: 'Peut-on créer un impact réel ?' },
  'layer.q4': { en: 'Will a decision happen?', fr: 'Y aura-t-il une décision ?' },

  // ── Variable labels ──
  'var.real_business_problem': { en: 'Real Business Problem', fr: 'Problème business réel' },
  'var.compelling_reason': { en: 'Compelling Reason', fr: 'Raison impérieuse' },
  'var.concerns_fit': { en: 'Concerns Fit', fr: 'Adéquation des préoccupations' },
  'var.stakeholder_map': { en: 'Stakeholder Map', fr: 'Carte des parties prenantes' },
  'var.personal_pain_linkage': { en: 'Personal Pain Linkage', fr: 'Lien douleur personnelle' },
  'var.credibility_perception': { en: 'Credibility & Perception', fr: 'Crédibilité et perception' },
  'var.value_solution_fit': { en: 'Value & Solution Fit', fr: 'Adéquation valeur/solution' },
  'var.competitive_position': { en: 'Competitive Position', fr: 'Position concurrentielle' },
  'var.urgency': { en: 'Urgency', fr: 'Urgence' },
  'var.product_capability': { en: 'Product Capability', fr: 'Capacité produit' },
  'var.implementation_feasibility': { en: 'Implementation Feasibility', fr: 'Faisabilité d\'implémentation' },
  'var.adoption_reality': { en: 'Adoption Reality', fr: 'Réalité d\'adoption' },
  'var.impact': { en: 'Impact', fr: 'Impact' },
  'var.urgency_resolution': { en: 'Urgency Resolution', fr: 'Résolution d\'urgence' },
  'var.value_momentum': { en: 'Value Momentum', fr: 'Momentum de valeur' },
  'var.strategic_alignment': { en: 'Strategic Alignment', fr: 'Alignement stratégique' },
  'var.internal_momentum': { en: 'Internal Momentum', fr: 'Momentum interne' },
  'var.open_objections': { en: 'Open Objections', fr: 'Objections ouvertes' },
  'var.process_drag': { en: 'Process Drag', fr: 'Frein de processus' },
  'var.external_friction': { en: 'External Friction', fr: 'Friction externe' },

  // ── Briefing sections ──
  'briefing.readSubtitle': { en: 'Where the deal stands', fr: 'Où en est le deal' },
  'briefing.angleSubtitle': { en: 'What needs to be accomplished', fr: 'Ce qu\'il faut accomplir' },
  'briefing.questionsSubtitle': { en: 'Sequential by diagnostic layer', fr: 'Séquencées par couche diagnostique' },
  'briefing.objectionsSubtitle': { en: 'Expected pushback', fr: 'Résistances anticipées' },
  'briefing.doNotSubtitle': { en: 'Avoid in this conversation', fr: 'À éviter dans cette conversation' },
  'briefing.winConditionSubtitle': { en: 'What success looks like after this round', fr: 'À quoi ressemble le succès après ce round' },

  // ── Verdicts ──
  'verdict.pass': { en: 'PASS', fr: 'OK' },
  'verdict.hold': { en: 'HOLD', fr: 'EN ATTENTE' },
  'verdict.atRisk': { en: 'AT RISK', fr: 'À RISQUE' },
  'verdict.empty': { en: 'EMPTY', fr: 'VIDE' },
  'verdict.emerging': { en: 'EMERGING', fr: 'ÉMERGENT' },
  'verdict.nascent': { en: 'NASCENT', fr: 'NAISSANT' },

  // ── Evidence ──
  'evidence.declared': { en: 'Declared', fr: 'Déclaré' },
  'evidence.corroborated': { en: 'Corroborated', fr: 'Corroboré' },
  'evidence.verified': { en: 'Verified', fr: 'Vérifié' },
  'evidence.declaredDesc': { en: 'One person said it, no proof', fr: 'Une personne l\'a dit, sans preuve' },
  'evidence.corroboratedDesc': { en: 'Multiple sources or repeated across rounds', fr: 'Plusieurs sources ou confirmé entre rounds' },
  'evidence.verifiedDesc': { en: 'Hard data, documents, or metrics shared', fr: 'Données, documents ou métriques partagés' },

  // ── Authority ──
  'authority.decision_maker': { en: 'Decision Maker', fr: 'Décideur' },
  'authority.influencer': { en: 'Influencer', fr: 'Influenceur' },
  'authority.end_user': { en: 'End User', fr: 'Utilisateur' },

  // ── Briefing ──
  'briefing.title': { en: 'Briefing', fr: 'Briefing' },
  'briefing.theLine': { en: 'The line', fr: 'La ligne' },
  'briefing.theRead': { en: 'The read', fr: 'La lecture' },
  'briefing.theAngle': { en: 'The angle', fr: "L'angle" },
  'briefing.winCondition': { en: 'Win condition', fr: 'Condition de victoire' },
  'briefing.fieldQuestions': { en: 'Field questions', fr: 'Questions terrain' },
  'briefing.pressing': { en: 'pressing', fr: 'prioritaire' },
  'briefing.opportunistic': { en: 'opportunistic', fr: 'opportuniste' },
  'briefing.opportunisticCapture': { en: 'Opportunistic — capture if it came up', fr: 'Opportuniste — à capturer si abordé' },
  'briefing.mirror': { en: 'Mirror terms', fr: 'Termes miroir' },
  'briefing.objections': { en: 'Likely objections', fr: 'Objections probables' },
  'briefing.objectionLikely': { en: 'Likely:', fr: 'Probable :' },
  'briefing.objectionFrame': { en: 'Frame:', fr: 'Recadrage :' },
  'briefing.doNot': { en: 'Do not', fr: 'À ne pas faire' },
  'briefing.noBriefing': { en: 'No briefing yet', fr: 'Pas de briefing' },
  'briefing.noBriefingDesc': { en: 'Generate a briefing from the dashboard.', fr: 'Générez un briefing depuis le tableau de bord.' },
  'briefing.goCapture': { en: '→ Go capture', fr: '→ Aller capturer' },

  // ── Capture ──
  'capture.title': { en: 'Capture', fr: 'Capture' },
  'capture.backToPipeline': { en: '← Back to pipeline', fr: '← Retour au pipeline' },
  'capture.historical': { en: 'Viewing historical capture — read only', fr: 'Capture historique — lecture seule' },
  'capture.briefingRequired': { en: 'Briefing required', fr: 'Briefing requis' },
  'capture.briefingRequiredDesc': { en: 'Generate a briefing before capturing this conversation. The briefing structures what to look for.', fr: 'Générez un briefing avant de capturer cette conversation. Le briefing structure ce qu\'il faut chercher.' },
  'capture.goToDashboard': { en: '→ Go to dashboard', fr: '→ Aller au tableau de bord' },
  'capture.logConversation': { en: 'Log conversation', fr: 'Journal de conversation' },
  'capture.logInstruction': { en: "Type what was actually said, in the prospect's words. Skip what didn't come up. Don't reframe — log it raw.", fr: "Notez ce qui a été réellement dit, dans les mots du prospect. Passez ce qui n'a pas été abordé. Ne reformulez pas — notez brut." },
  'capture.pressingPlaceholder': { en: "What did they say? Skip if it didn't come up.", fr: "Qu'ont-ils dit ? Passez si ce n'est pas venu." },
  'capture.opportunisticPlaceholder': { en: 'Only if it came up naturally.', fr: "Seulement si c'est venu naturellement." },
  'capture.nothingCaptured': { en: 'Nothing captured', fr: 'Rien capturé' },
  'capture.freeNote': { en: 'Everything else that was said', fr: 'Tout ce qui a été dit d\'autre' },
  'capture.freeNotePlaceholder': { en: "Everything the prospect said outside the questions above: objections, names mentioned, budget signals, timing, competition, internal politics, blockers, accelerators…", fr: "Tout ce que le prospect a dit en dehors des questions ci-dessus : objections, noms de personnes mentionnées, signaux sur le budget, le timing, la concurrence, la politique interne, les freins, les accélérateurs…" },
  'capture.save': { en: 'Save', fr: 'Sauvegarder' },
  'capture.saving': { en: 'Saving…', fr: 'Sauvegarde…' },
  'capture.analyze': { en: '✦ Analyze → Dashboard', fr: '✦ Analyser → Tableau de bord' },
  'capture.analyzing': { en: 'Analyzing…', fr: 'Analyse…' },
  'capture.noBriefingQuestions': { en: 'No briefing questions yet', fr: 'Pas de questions de briefing' },

  // ── Boxes ──
  'boxes.title': { en: 'Knowledge Boxes', fr: 'Boîtes de connaissance' },
  'boxes.collected': { en: 'Collected', fr: 'Collecté' },
  'boxes.built': { en: 'Built', fr: 'Construit' },
  'boxes.empty': { en: 'No entries yet', fr: 'Aucune entrée' },

  // ── Context ──
  'context.title': { en: 'Account Context', fr: 'Contexte compte' },
  'context.prospectUrl': { en: 'Prospect URL', fr: 'URL du prospect' },
  'context.import': { en: 'Import from URL', fr: 'Importer depuis URL' },
  'context.importing': { en: 'Importing…', fr: 'Import…' },

  // ── Profile ──
  'profile.title': { en: 'My Profile', fr: 'Mon Profil' },
  'profile.companyName': { en: 'Company name', fr: "Nom de l'entreprise" },
  'profile.companyUrl': { en: 'Company URL', fr: "URL de l'entreprise" },
  'profile.save': { en: 'Save', fr: 'Sauvegarder' },
  'profile.saving': { en: 'Saving…', fr: 'Sauvegarde…' },
  'profile.importFromUrl': { en: 'Import from URL →', fr: 'Importer depuis URL →' },

  // ── Common ──
  'common.loading': { en: 'Loading…', fr: 'Chargement…' },
  'common.error': { en: 'Error', fr: 'Erreur' },
  'common.cancel': { en: 'Cancel', fr: 'Annuler' },
  'common.confirm': { en: 'Confirm', fr: 'Confirmer' },
  'common.back': { en: 'Back', fr: 'Retour' },
  'common.next': { en: 'Next', fr: 'Suivant' },

  // ── Time ──
  'time.today': { en: 'today', fr: "aujourd'hui" },
  'time.yesterday': { en: 'yesterday', fr: 'hier' },
  'time.daysAgo': { en: '{n}d ago', fr: 'il y a {n}j' },
  'time.hoursAgo': { en: '{n}h ago', fr: 'il y a {n}h' },
  'time.minutesAgo': { en: '{n} min ago', fr: 'il y a {n} min' },
} as const

export type TranslationKey = keyof typeof translations

export function t(key: TranslationKey, locale: Locale, params?: Record<string, string | number>): string {
  const entry = translations[key]
  let text: string = entry?.[locale] ?? entry?.['en'] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v))
    }
  }
  return text
}
