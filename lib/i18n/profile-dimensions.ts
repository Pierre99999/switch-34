import type { VendorDimensions } from '@/lib/types'
import type { Locale } from './translations'

type SubQuestion = { key: string; label: string; hint: string }
type DimensionDef = { key: keyof VendorDimensions; label: string; description: string; questions: SubQuestion[] }

const DIMENSIONS_EN: DimensionDef[] = [
  {
    key: 'value', label: '1 · Value', description: 'Whether you have identified a real problem, articulated a distinctive point of view, created value that lands, earned market validation, and understand your competitive standing.',
    questions: [
      { key: 'problem', label: "The problem you're solving", hint: 'How real and urgent the pain is, who feels it most, what it costs, current alternatives, and surrounding misconceptions.' },
      { key: 'point_of_view', label: "Your point of view and how you're different", hint: 'Your distinctive stance, unique mechanism, positioning, and how clearly that stance comes through.' },
      { key: 'value_delivered', label: 'The value you deliver', hint: 'The before/after transformation, value drivers, measurable impact, and stated promise.' },
      { key: 'value_reliability', label: 'Whether the value reliably lands', hint: 'How fast value appears, what delivery means, what creates early wins, and what enables or blocks realization.' },
      { key: 'market_response', label: 'How the market actually responds', hint: 'Customer reception, proof points, objections, high-value outcomes, and visible success signals.' },
      { key: 'competitive_standing', label: 'Where you stand against the alternatives', hint: 'The real competitive set, differentiation in deals, pricing position, market context, and recent shifts.' },
    ],
  },
  {
    key: 'target', label: '2 · Target', description: 'Whether you are going after the right people, at the right time, with the right framing, and whether you qualify, convert, and still understand them.',
    questions: [
      { key: 'who_youre_for', label: "Who you're for", hint: 'Target segments, ICP, personas, best-fit and poor-fit customers, fit signals, and prioritized segments.' },
      { key: 'positioning', label: "How you're positioned and perceived", hint: 'Market position, perceived angle, messaging surfaces, and the gap between intended and received brand.' },
      { key: 'market_timing', label: 'Why now — market timing', hint: 'Trends, pressures, tech or regulatory shifts, market risk, and the timing thesis behind the opportunity.' },
      { key: 'qualification', label: 'What makes a prospect a fit', hint: 'Qualification logic, decisive fit features, disqualifiers, tier logic, and sales-readiness signals.' },
      { key: 'sales_motion', label: 'How the sales motion converts', hint: 'Sales stages, objections, delays, alternatives, buying process, conversion moments, and proof required.' },
      { key: 'customer_knowledge', label: 'How well you actually know them', hint: 'Freshness and depth of customer understanding, customer voice, complaints, post-sale signals, and listening cadence.' },
    ],
  },
  {
    key: 'product', label: '3 · Produit', description: "The product's concrete state, vision, roadmap discipline, defensibility, user experience, technical foundation, and health in real use.",
    questions: [
      { key: 'current_product', label: 'What the product is today', hint: 'Current offering, tiers, core features, modules, and the concrete product as it exists now.' },
      { key: 'vision', label: 'Product vision', hint: 'Clarity, ambition, transformation, positioning, and whether multi-year goals support the vision.' },
      { key: 'roadmap', label: "The roadmap and what you're building", hint: 'Current priorities, upcoming releases, beta features, and how the product is evolving.' },
      { key: 'defensibility', label: 'What makes it hard to copy', hint: 'Proprietary mechanisms, moats, switching costs, proof of defensibility, and what competitors cannot easily replicate.' },
      { key: 'user_experience', label: 'The user experience', hint: 'Product structure, navigation, onboarding, time-to-value, key flows, and friction points.' },
      { key: 'technical_foundation', label: 'Technical foundation', hint: 'Scalability, architecture, performance, technical debt, organizational requirements, and known constraints.' },
      { key: 'product_health', label: 'Product health in the wild', hint: 'Bugs, customer complaints, low-adoption features, recent changes, and feedback across user segments.' },
    ],
  },
  {
    key: 'reach', label: '4 · Reach', description: 'How you reach your market through GTM strategy, distribution focus, messaging, channels, execution capacity, and performance against goals.',
    questions: [
      { key: 'gtm_model', label: 'How you go to market', hint: 'GTM model, acquisition approach, funnel structure, conversion points, and buying-cycle friction.' },
      { key: 'reach_focus', label: 'Whether your reach is aimed at the right people', hint: 'Whether distribution is focused on the right niche and urgent pain, or spread too broadly.' },
      { key: 'message_cta', label: 'Your message and call to action', hint: 'Clarity and distinctiveness of headlines, value proposition, claims, proof, tone, and CTA.' },
      { key: 'channels', label: 'Your channels', hint: 'Channel mix, audience fit, discovery points, proof channels, and influence touchpoints.' },
      { key: 'execution_capacity', label: 'Your capacity to execute', hint: 'Whether the team has enough resources, budget, and bandwidth to run the GTM motion.' },
      { key: 'performance', label: "Whether it's working — objectives vs actuals", hint: 'Goals, OKRs, funnel tracking, execution focus, and whether performance variance is understood.' },
    ],
  },
  {
    key: 'usage', label: '5 · Usage', description: 'How users actually engage with the product: activation, adoption, retention, churn, expansion, monetization, and instrumentation.',
    questions: [
      { key: 'core_action', label: 'Getting to the core action', hint: 'Whether users reach first value quickly, where the core action happens, and where new users get stuck.' },
      { key: 'feature_adoption', label: 'Feature adoption', hint: 'Whether users adopt the features that create value, what blocks adoption, and how deep usage becomes.' },
      { key: 'retention', label: 'Retention and engagement', hint: 'Whether users stay active, remain healthy, progress over time, and continue perceiving value.' },
      { key: 'churn', label: 'Churn and account risk', hint: 'Why customers leave, early warning signs, commercial risks, organizational instability, and champion vulnerability.' },
      { key: 'expansion', label: 'Expansion and advocacy', hint: 'Signals that accounts are ready to grow, expand usage, refer others, or advocate publicly.' },
      { key: 'monetization', label: 'Monetization', hint: 'How usage converts into revenue through pricing, packaging, tiers, value capture, and price sensitivity.' },
      { key: 'instrumentation', label: 'Usage metrics and instrumentation', hint: 'Whether the team measures the right usage metrics and uses them to make decisions.' },
    ],
  },
  {
    key: 'finance', label: '6 · Finance', description: 'Cash discipline, revenue trajectory, expense control, financial literacy, unit economics, and forecasting capability.',
    questions: [
      { key: 'revenue', label: 'Revenue', hint: 'Revenue model, growth trajectory, expansion and retention drivers, and predictability of growth.' },
      { key: 'costs', label: 'Costs', hint: 'Spending, burn, team cost, cost discipline, and whether expenses are proportional to growth.' },
      { key: 'capital_runway', label: 'Capital and runway', hint: 'Cash position, funding status, burn versus growth, runway, and recent financial events.' },
      { key: 'unit_economics', label: 'Financial metrics and unit economics', hint: 'CAC, LTV, payback, margins, ROI thinking, and whether the team acts on these numbers.' },
      { key: 'forecasting', label: 'Forecasting', hint: 'Ability to project cash and P&L, forecast beyond 12 months, and adjust based on real data.' },
    ],
  },
  {
    key: 'scale', label: '7 · Scale', description: 'Whether you are ready to grow: scalable channels, bottleneck elimination, investment focus, and talent planning.',
    questions: [
      { key: 'growth_channel', label: 'Whether your growth channel can scale', hint: 'Whether the main growth channel can double without breaking CAC, LTV, margins, or operations.' },
      { key: 'bottleneck', label: 'Your growth bottleneck', hint: 'The main constraint to growth — technical, operational, support, organizational, or authority-related.' },
      { key: 'investment_focus', label: "Where you're investing and focusing", hint: 'Whether investment and effort go to the highest-ROI priority instead of scattered initiatives.' },
      { key: 'talent_plan', label: 'Your talent and hiring plan', hint: 'Current team gaps, future hiring needs, org capacity, and whether hiring supports the roadmap.' },
    ],
  },
  {
    key: 'playbook', label: '8 · Playbook', description: 'Whether you capture, codify, share, and apply learnings to improve operational performance.',
    questions: [
      { key: 'capture_lessons', label: 'How you capture lessons', hint: 'Whether the team learns from wins, losses, projects, deals, failures, and recurring patterns.' },
      { key: 'codify', label: 'How you codify what works', hint: 'Whether lessons become written playbooks, standards, role expectations, and repeatable methods.' },
      { key: 'build_capability', label: 'How you build team capability', hint: 'Whether the team uses playbooks to develop skills, spread knowledge, and improve collaboration.' },
      { key: 'impact', label: 'Whether it moves the numbers', hint: 'Whether playbooks improve business KPIs and create measurable operational impact.' },
    ],
  },
  {
    key: 'foundations', label: '9 · Foundations', description: 'The organizational base: vision, culture, team health, engagement, wellbeing, and self-awareness.',
    questions: [
      { key: 'vision_purpose', label: 'Vision and purpose', hint: "Whether the company's why and direction are clear, understood, and lived by the team." },
      { key: 'culture', label: 'Culture and lived values', hint: 'Whether culture is intentional, codified, lived in practice, and reflected in leadership behavior.' },
      { key: 'team_status', label: 'Team status', hint: 'Team structure, role clarity, performance, development needs, and organizational capacity.' },
      { key: 'engagement', label: 'Engagement and wellbeing', hint: 'Morale, engagement, burnout risk, psychological safety, and readiness during change.' },
      { key: 'strengths', label: 'Strengths and improvement', hint: 'Whether you honestly understand your strengths, weaknesses, and improvement priorities.' },
    ],
  },
]

const DIMENSIONS_FR: DimensionDef[] = [
  {
    key: 'value', label: '1 · Valeur', description: 'Avez-vous identifié un vrai problème, articulé un point de vue distinctif, créé une valeur qui atterrit, obtenu une validation marché, et compris votre positionnement concurrentiel.',
    questions: [
      { key: 'problem', label: 'Le problème que vous résolvez', hint: 'À quel point la douleur est réelle et urgente, qui la ressent le plus, ce qu\'elle coûte, les alternatives actuelles et les idées reçues.' },
      { key: 'point_of_view', label: 'Votre point de vue et ce qui vous différencie', hint: 'Votre posture distinctive, mécanisme unique, positionnement, et la clarté de cette posture.' },
      { key: 'value_delivered', label: 'La valeur que vous délivrez', hint: 'La transformation avant/après, les leviers de valeur, l\'impact mesurable et la promesse formulée.' },
      { key: 'value_reliability', label: 'Est-ce que la valeur atterrit de façon fiable', hint: 'Rapidité d\'apparition de la valeur, ce que la livraison implique, les premières victoires, et ce qui freine ou accélère.' },
      { key: 'market_response', label: 'Comment le marché réagit réellement', hint: 'Réception client, preuves, objections, résultats à forte valeur, et signaux de succès visibles.' },
      { key: 'competitive_standing', label: 'Où vous vous situez face aux alternatives', hint: 'L\'environnement concurrentiel réel, la différenciation en deal, le positionnement prix, le contexte marché.' },
    ],
  },
  {
    key: 'target', label: '2 · Cible', description: 'Allez-vous vers les bonnes personnes, au bon moment, avec le bon cadrage, et qualifiez-vous, convertissez-vous, comprenez-vous encore vos clients.',
    questions: [
      { key: 'who_youre_for', label: 'Pour qui êtes-vous', hint: 'Segments cibles, ICP, personas, clients idéaux et mauvais fits, signaux de fit, segments prioritaires.' },
      { key: 'positioning', label: 'Comment êtes-vous positionné et perçu', hint: 'Position marché, angle perçu, surfaces de messaging, écart entre image voulue et reçue.' },
      { key: 'market_timing', label: 'Pourquoi maintenant — timing marché', hint: 'Tendances, pressions, changements tech ou réglementaires, risque marché, et thèse de timing.' },
      { key: 'qualification', label: 'Ce qui fait qu\'un prospect est un bon fit', hint: 'Logique de qualification, critères décisifs, disqualifiants, logique de tiers, signaux de maturité.' },
      { key: 'sales_motion', label: 'Comment le mouvement commercial convertit', hint: 'Étapes de vente, objections, délais, alternatives, processus d\'achat, moments de conversion.' },
      { key: 'customer_knowledge', label: 'À quel point vous connaissez vos clients', hint: 'Fraîcheur et profondeur de la compréhension client, voix du client, plaintes, signaux post-vente.' },
    ],
  },
  {
    key: 'product', label: '3 · Produit', description: 'L\'état concret du produit, sa vision, la discipline roadmap, la défensabilité, l\'expérience utilisateur, les fondations techniques, et la santé en usage réel.',
    questions: [
      { key: 'current_product', label: 'Ce qu\'est le produit aujourd\'hui', hint: 'Offre actuelle, tiers, fonctionnalités clés, modules, et le produit tel qu\'il existe concrètement.' },
      { key: 'vision', label: 'Vision produit', hint: 'Clarté, ambition, transformation, positionnement, et si les objectifs pluriannuels soutiennent la vision.' },
      { key: 'roadmap', label: 'La roadmap et ce que vous construisez', hint: 'Priorités actuelles, prochaines versions, fonctionnalités en beta, et comment le produit évolue.' },
      { key: 'defensibility', label: 'Ce qui rend le produit difficile à copier', hint: 'Mécanismes propriétaires, moats, coûts de switching, preuves de défensabilité.' },
      { key: 'user_experience', label: 'L\'expérience utilisateur', hint: 'Structure produit, navigation, onboarding, time-to-value, flux clés, et points de friction.' },
      { key: 'technical_foundation', label: 'Fondations techniques', hint: 'Scalabilité, architecture, performance, dette technique, contraintes organisationnelles.' },
      { key: 'product_health', label: 'Santé du produit sur le terrain', hint: 'Bugs, plaintes clients, fonctionnalités sous-utilisées, changements récents, et retours par segment.' },
    ],
  },
  {
    key: 'reach', label: '4 · Distribution', description: 'Comment vous atteignez votre marché : stratégie GTM, focus distribution, messaging, canaux, capacité d\'exécution, et performance vs objectifs.',
    questions: [
      { key: 'gtm_model', label: 'Comment vous allez au marché', hint: 'Modèle GTM, approche d\'acquisition, structure de funnel, points de conversion, friction du cycle d\'achat.' },
      { key: 'reach_focus', label: 'Si votre distribution vise les bonnes personnes', hint: 'Si la distribution cible la bonne niche et la bonne douleur urgente, ou si elle est trop dispersée.' },
      { key: 'message_cta', label: 'Votre message et appel à l\'action', hint: 'Clarté et différenciation des titres, proposition de valeur, claims, preuves, ton, et CTA.' },
      { key: 'channels', label: 'Vos canaux', hint: 'Mix de canaux, adéquation audience, points de découverte, canaux de preuve, et touchpoints d\'influence.' },
      { key: 'execution_capacity', label: 'Votre capacité d\'exécution', hint: 'Si l\'équipe a assez de ressources, budget et bande passante pour exécuter le mouvement GTM.' },
      { key: 'performance', label: 'Est-ce que ça marche — objectifs vs résultats', hint: 'Objectifs, OKRs, suivi de funnel, focus d\'exécution, et si la variance de performance est comprise.' },
    ],
  },
  {
    key: 'usage', label: '5 · Usage', description: 'Comment les utilisateurs interagissent réellement avec le produit : activation, adoption, rétention, churn, expansion, monétisation, et instrumentation.',
    questions: [
      { key: 'core_action', label: 'Accès à l\'action clé', hint: 'Si les utilisateurs atteignent la première valeur rapidement, où se situe l\'action clé, et où les nouveaux utilisateurs bloquent.' },
      { key: 'feature_adoption', label: 'Adoption des fonctionnalités', hint: 'Si les utilisateurs adoptent les fonctionnalités qui créent de la valeur, ce qui bloque l\'adoption, et la profondeur d\'usage.' },
      { key: 'retention', label: 'Rétention et engagement', hint: 'Si les utilisateurs restent actifs, progressent dans le temps, et continuent de percevoir de la valeur.' },
      { key: 'churn', label: 'Churn et risque compte', hint: 'Pourquoi les clients partent, signaux d\'alerte précoces, risques commerciaux, instabilité organisationnelle.' },
      { key: 'expansion', label: 'Expansion et advocacy', hint: 'Signaux que les comptes sont prêts à grandir, étendre l\'usage, référer d\'autres, ou devenir ambassadeurs.' },
      { key: 'monetization', label: 'Monétisation', hint: 'Comment l\'usage se convertit en revenu via pricing, packaging, tiers, capture de valeur, et sensibilité prix.' },
      { key: 'instrumentation', label: 'Métriques d\'usage et instrumentation', hint: 'Si l\'équipe mesure les bonnes métriques d\'usage et les utilise pour prendre des décisions.' },
    ],
  },
  {
    key: 'finance', label: '6 · Finance', description: 'Discipline cash, trajectoire de revenu, contrôle des dépenses, culture financière, unit economics, et capacité de prévision.',
    questions: [
      { key: 'revenue', label: 'Revenu', hint: 'Modèle de revenu, trajectoire de croissance, leviers d\'expansion et de rétention, et prédictibilité.' },
      { key: 'costs', label: 'Coûts', hint: 'Dépenses, burn, coût de l\'équipe, discipline des coûts, et si les dépenses sont proportionnelles à la croissance.' },
      { key: 'capital_runway', label: 'Capital et runway', hint: 'Position cash, statut de financement, burn vs croissance, runway, et événements financiers récents.' },
      { key: 'unit_economics', label: 'Métriques financières et unit economics', hint: 'CAC, LTV, payback, marges, raisonnement ROI, et si l\'équipe agit sur ces chiffres.' },
      { key: 'forecasting', label: 'Prévisions', hint: 'Capacité à projeter cash et P&L, prévoir au-delà de 12 mois, et ajuster sur données réelles.' },
    ],
  },
  {
    key: 'scale', label: '7 · Scale', description: 'Êtes-vous prêt à grandir : canaux scalables, élimination des goulots, focus d\'investissement, et planification talents.',
    questions: [
      { key: 'growth_channel', label: 'Si votre canal de croissance peut scaler', hint: 'Si le canal principal peut doubler sans casser le CAC, LTV, les marges, ou les opérations.' },
      { key: 'bottleneck', label: 'Votre goulot d\'étranglement de croissance', hint: 'La contrainte principale — technique, opérationnelle, support, organisationnelle, ou liée à l\'autorité.' },
      { key: 'investment_focus', label: 'Où vous investissez et concentrez vos efforts', hint: 'Si l\'investissement et l\'effort vont à la priorité au meilleur ROI plutôt qu\'à des initiatives dispersées.' },
      { key: 'talent_plan', label: 'Votre plan talent et recrutement', hint: 'Gaps d\'équipe actuels, besoins de recrutement, capacité org, et si le recrutement soutient la roadmap.' },
    ],
  },
  {
    key: 'playbook', label: '8 · Playbook', description: 'Si vous capturez, codifiez, partagez et appliquez les apprentissages pour améliorer la performance opérationnelle.',
    questions: [
      { key: 'capture_lessons', label: 'Comment vous capturez les leçons', hint: 'Si l\'équipe apprend des victoires, échecs, projets, deals, et patterns récurrents.' },
      { key: 'codify', label: 'Comment vous codifiez ce qui marche', hint: 'Si les leçons deviennent des playbooks écrits, standards, attentes de rôle, et méthodes répétables.' },
      { key: 'build_capability', label: 'Comment vous développez les compétences', hint: 'Si l\'équipe utilise les playbooks pour développer les skills, diffuser les connaissances, et améliorer la collaboration.' },
      { key: 'impact', label: 'Est-ce que ça fait bouger les chiffres', hint: 'Si les playbooks améliorent les KPIs business et créent un impact opérationnel mesurable.' },
    ],
  },
  {
    key: 'foundations', label: '9 · Fondations', description: 'La base organisationnelle : vision, culture, santé de l\'équipe, engagement, bien-être, et lucidité.',
    questions: [
      { key: 'vision_purpose', label: 'Vision et raison d\'être', hint: 'Si le pourquoi et la direction de l\'entreprise sont clairs, compris, et vécus par l\'équipe.' },
      { key: 'culture', label: 'Culture et valeurs vécues', hint: 'Si la culture est intentionnelle, codifiée, vécue en pratique, et reflétée dans le comportement du leadership.' },
      { key: 'team_status', label: 'État de l\'équipe', hint: 'Structure, clarté des rôles, performance, besoins de développement, et capacité organisationnelle.' },
      { key: 'engagement', label: 'Engagement et bien-être', hint: 'Moral, engagement, risque de burnout, sécurité psychologique, et capacité d\'adaptation au changement.' },
      { key: 'strengths', label: 'Forces et axes d\'amélioration', hint: 'Si vous comprenez honnêtement vos forces, faiblesses, et priorités d\'amélioration.' },
    ],
  },
]

export function getDimensions(locale: Locale): DimensionDef[] {
  return locale === 'fr' ? DIMENSIONS_FR : DIMENSIONS_EN
}

export type { DimensionDef, SubQuestion }
