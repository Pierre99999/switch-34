# 02 — La méthode encodée

Ce document décrit la mécanique du diagnostic telle qu'elle est **réellement
implémentée**. Le fichier de référence est `lib/scoring.ts` ; les définitions
des critères sont dans `lib/criterion-definitions.ts`.

## Les quatre couches

Trois portes **séquentielles**, plus un momentum **parallèle**.

| # | Nom affiché | La question de la méthode |
|---|---|---|
| 1 | L'opportunité | « Est-ce que je reste ? » |
| 2 | La capacité à gagner | « Est-ce que je peux vendre ? » |
| 3 | L'impact | « Quel impact — sera-t-il adopté ? » |
| 4 | Momentum | « Une décision se construit-elle ? » |

Séquentiel signifie qu'une porte ne peut afficher « franchie » que si la
précédente l'est (`gateInfo`, champ `waitingForGate`). **Mais uniquement pour
le verdict** : les preuves, elles, se collectent dans n'importe quel ordre. Ce
qui a été dit sur l'impact au round 1 est une preuve du round 1 — le prompt de
notation le dit explicitement, parce que l'oublier vidait la porte 3 pendant
des rounds entiers.

## Les vingt critères et leurs poids

**Porte 1 — L'opportunité**
| Critère | Poids | ⚡ |
|---|---|---|
| Raison impérieuse | 0,30 | décisif |
| Douleur personnelle | 0,30 | décisif |
| Problème business réel | 0,20 | |
| Carte des parties prenantes | 0,10 | |
| Adéquation avec le terrain de jeu | 0,10 | |

Les cinq conditions sont **nécessaires** : deux critères sous 2,0 mettent la
porte à risque, un seul la retient (`gateInfo`, cas `gate === 1`).

**Porte 2 — La capacité à gagner**
| Critère | Poids | ⚡ |
|---|---|---|
| Urgence | 0,40 | décisif |
| Adéquation problème/solution | 0,25 | |
| Crédibilité et perception | 0,20 | |
| Position concurrentielle | 0,15 | |

Sans urgence ≥ 3,5, la porte reste « en construction » même si la moyenne
passe.

**Porte 3 — L'impact**
Capacité produit, faisabilité de mise en œuvre, réalité de l'adoption, impact,
résolution de l'urgence (décisif). Sans résolution de l'urgence ≥ 3,0, la
porte ne se franchit pas.

**Momentum (parallèle)**
| Critère | Poids | Nature |
|---|---|---|
| Momentum de valeur | 0,25 | moteur |
| Dynamique interne | 0,20 | moteur |
| Alignement stratégique | 0,15 | moteur |
| Budget | 0,15 | frein |
| Objections ouvertes | 0,10 | frein |
| Concurrence | 0,10 | frein |
| Pression externe | 0,05 | frein |

**Les freins se notent en santé, pas en gravité** : 5 = exploré et propre,
0 = jamais exploré. Un frein jamais exploré compte **zéro** — l'absence
d'information n'est pas l'absence de frein. Inverser cette convention
retournerait tout le score de momentum ; deux tests la verrouillent.

## Le plafond de preuve

C'est le cœur du produit. Un signal brut (0–5) est **plafonné** par le niveau
de preuve qui le soutient :

| Niveau | Plafond |
|---|---|
| Déclaré (une voix) | 2,5 |
| Corroboré (deux voix, ou une voix à contre-intérêt) | 4,0 |
| Vérifié (chiffre, document, fait) | 5,0 |

Conséquence : **aucune porte ne se franchit sur du déclaratif.** L'enthousiasme
d'un champion, seul, ne fait pas passer une porte. C'est voulu, et c'est ce que
la plupart des CRM ne font pas.

## Le crédit de voix

Le niveau de preuve n'est pas saisi, il est **calculé** à partir de qui a parlé
(`lib/voice-credit.ts`, `lib/voice-weights.ts`). Chaque critère a des rôles qui
comptent plein (1,0), à moitié (0,7) ou peu. Deux règles particulières :

- **Le propriétaire** — sur la douleur personnelle et la perception, seule la
  personne concernée parle d'elle-même : son témoignage vaut 1,0.
- **Le contre-intérêt** — un bloqueur qui concède un point favorable corrobore
  à lui seul. Il n'a aucune raison de le dire.

## Les prescriptions

Pour chaque critère sous 3,5, le moteur dit ce que la prochaine conversation
doit en faire (`prescriptions()`), en quatre formes :

| Forme | Signification | Ce qu'il faut faire |
|---|---|---|
| Zone aveugle | rien n'a été dit | ouvrir le sujet |
| À corroborer | une seule voix | trouver la deuxième |
| À préciser | corroboré mais vague | chiffrer, dater, nommer la conséquence |
| À trancher | défavorable et corroboré sur un critère décisif | décider, ou partir |

« À préciser » a été ajouté après un bug : tout ce qui n'entrait dans aucune
autre catégorie était étiqueté « à corroborer », y compris des critères déjà
corroborés — l'écran demandait un deuxième témoin sur ce qu'il affichait par
ailleurs comme corroboré.

## Le round

Un round est un cycle de conversation, pas une conversation.

- **Un nouveau round hérite** des notes, niveaux de preuve, autorités et
  justifications du précédent (`inheritedRoundFields`). Un round n'est pas un
  nouveau deal.
- **L'état d'un round** (`roundState`) se déduit de la capture, jamais des
  scores : `UNSTARTED` → `BRIEFED` → `SCORED`. Un round hérité affiche donc
  bien « conversation à capturer ».
- **Un round passé est figé.** Toutes les écritures ciblent un `roundId`
  précis. C'est ce qui permet l'historique par critère (`criterion-history.ts`)
  sans stocker quoi que ce soit de plus : chaque round porte déjà sa photo
  complète des vingt critères.
- **Le round courant n'est pas figé** tant qu'il est courant : une seconde
  capture sur le même round refait la notation sur l'ensemble de la matière.

## L'adéquation au playbook

Lecture parallèle au diagnostic, **jamais mélangée aux scores**
(`lib/playbook-fit.ts`). Cinq axes comparés au socle, chacun avec un verdict
(aligné / partiel / hors cadre / inconnu). Deux mécanismes en découlent :

- **La liste à fuir** (A2) — quand un prospect y ressemble, c'est le premier
  signal affiché partout : c'est la décision la moins chère, et celle qu'un
  vendeur évite le plus longtemps.
- **La couverture des rôles** (A5) — les rôles que le socle juge nécessaires,
  confrontés aux contacts du deal. Un rôle absent devient une action.

## Ce que le produit refuse de faire

Ces refus sont implémentés, pas seulement écrits :

- **Prédire.** Aucun pourcentage de signature, aucun impact chiffré attendu,
  aucun « ce deal va se signer ». Les copilotes le refusent explicitement, et
  un test échoue si un delta chiffré réapparaît dans les actions de Mission
  Control.
- **Noter sans capture.** `suggest-scores` renvoie 400 avant tout appel modèle
  si le round n'a rien de capturé.
- **Adoucir.** Les prompts l'interdisent en toutes lettres : « un vendeur qui
  lit "ça a l'air prometteur" n'apprend rien ».
- **Inventer.** « Je ne sais pas, rien dans le diagnostic ne le dit » est une
  réponse correcte et attendue.
