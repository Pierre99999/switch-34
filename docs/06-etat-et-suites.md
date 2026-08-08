# 06 — État et suites

*Dernière mise à jour : 8 août 2026.*

## L'avertissement qui compte

**Le parcours complet n'a jamais été exercé de bout en bout par un vrai
utilisateur.** Playbook → prospect → briefing → conversation → transcript →
notation → round suivant : chaque morceau a été construit et testé
unitairement, la chaîne entière n'a jamais tourné en conditions réelles.

Le build passe, les types passent, 208 tests passent. Ça ne dit rien de ce
qui se passe quand un commercial s'en sert un mardi matin.

Les testeurs sont sur la nouvelle interface depuis qu'elle a remplacé
l'ancienne. C'est là que les vrais défauts vont apparaître.

## À vérifier en priorité

1. **Les migrations de fin de session** (voir [05](05-migrations.md)) — sans
   elles, la création de briefing et la carte cassent.
2. **La carte du portefeuille** — jamais vue rendue. La séparation des points
   est testée mathématiquement, pas visuellement.
3. **Un round complet sur un vrai deal** — surtout la porte 3 et l'adéquation
   avec le terrain de jeu, deux critères qui restaient vides et dont les
   définitions viennent d'être réécrites.

## Dette connue

**Le préfixe `/lab` dans les URL** — vestige de l'époque où c'était une
seconde interface. Un renommage vers les routes canoniques est possible mais
demande de traiter les redirections.

**Une erreur ESLint récurrente** — `react-hooks/set-state-in-effect` sur le
motif `useEffect(() => { load() }, [load])`, une vingtaine d'occurrences. Le
build passe ; le motif est ancien et uniforme.

**Une quarantaine de clés de traduction orphelines**, héritées des écrans
supprimés.

**Une centaine de ternaires `locale === 'fr' ? … : …`** dispersés dans les
composants du lab, là où la table de traductions ferait mieux. Le lab a été
écrit en français direct pour aller vite.

**`components/pipeline/`** ne contient plus qu'`OutcomeDialog`, utilisé par
l'écran du deal. Le dossier mériterait d'être renommé.

## Pistes discutées, non engagées

**L'apprentissage à partir des deals clos.** L'idée est posée et la donnée
commence à se collecter. Trois étages :

1. *Fait* — capturer l'issue à la clôture (raisons rattachées aux portes).
2. *À ~10 deals clos* — le raisonnement par cas : « ce prospect ressemble à
   REVO et à Sanofi ; sur les deux, le gardien du budget n'est jamais entré
   avant le round 4 ». Pas de statistiques, un rappel de sa propre histoire.
3. *À ~30 deals clos* — les patterns propres à un vendeur, avec trois règles
   en dur : jamais de chiffre sans dénominateur, toujours le contre-exemple
   affiché, jamais un verdict — une question. Un red flag qui dit « pars » se
   réalise tout seul.

Et un objet durable « ce qu'on a appris de vous », éditable, que le vendeur
valide, et qui remonte dans le socle : un pattern validé trois fois n'est plus
un insight, c'est une ligne du playbook.

**Le playbook multi-produits.** Un prospect peut acheter plusieurs produits.
Recommandation faite : commencer par une colonne « Produit » sur A1, sans
modules séparés.

**Switch comme outil de coaching** (email, voix). Recommandation faite :
commencer par l'entrée de transcript par email.

**La révocation d'un lien de briefing** — remettre le jeton à `null` ; pas
d'interface aujourd'hui.

**Remonter les intervenants des rounds passés** vers les contacts des deals.
Depuis peu, un intervenant d'un transcript devient un contact ; les rounds
antérieurs à ce correctif ne l'ont pas fait. Faisable en SQL, avec prudence
sur les doublons.

## Ce qui a été corrigé récemment, et qu'il ne faut pas réintroduire

- Un nouveau round qui repartait de zéro au lieu d'hériter.
- « À corroborer » affiché sur des critères déjà corroborés.
- La porte 3 et l'adéquation au terrain de jeu qui restaient vides — le prompt
  ne disait pas ce que ces critères demandaient.
- Le `.docx` accepté puis lu en binaire.
- Le focus qui redevenait générique dès qu'un briefing existait.
- Les noms de variables bruts affichés à l'écran (`concerns_fit`).
- La valeur pesée deux fois, porte 2 et porte 3.
- Mission Control et l'écran du deal qui ne disaient pas la même chose du même
  round : la phrase vient maintenant de `lib/round-focus.ts`, des deux côtés.
- Les liens de la timeline qui renvoyaient vers l'ancienne interface
  (`/deals/:id/capture`, `/deals/:id/context`) : le premier ouvrait un
  formulaire vide sur le round courant, le second sortait du lab. La capture se
  lit maintenant sur place (`CaptureLetter`), le contexte pointe sur
  `/lab/deals/:id/context`. **Un lien du lab vers `/deals/...` est un bug.**
