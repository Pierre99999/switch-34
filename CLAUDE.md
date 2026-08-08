@AGENTS.md

# Switch

Compagnon logiciel de la méthode de vente de Pierre Gaubil. **Lire `docs/`
avant de travailler sur ce projet** — en particulier
[docs/04-decisions.md](docs/04-decisions.md), qui dit pourquoi les choses sont
faites ainsi et évite de défaire par ignorance ce qui a été fait exprès.

## Tenir la documentation à jour

`docs/` est la mémoire du projet : elle survit à la fin d'une conversation,
pas le contexte. La maintenir fait partie du travail, pas de la finition.

**Mettre à jour dans le même commit que le changement :**

| Ce que vous changez | Ce que vous mettez à jour |
|---|---|
| Un poids, un seuil, un critère, une règle du moteur | `docs/02-methode.md` |
| Une route, un module de `lib/`, une colonne | `docs/03-architecture.md` |
| Un écran ajouté, supprimé ou renommé | `docs/01-produit.md` |
| Un fichier `.sql` | `docs/05-migrations.md`, avec son statut |
| Un arbitrage qu'un futur lecteur pourrait défaire | `docs/04-decisions.md` |
| Une dette, une piste, un correctif notable | `docs/06-etat-et-suites.md` |

**Une entrée de `04-decisions.md` dit toujours pourquoi, pas seulement quoi.**
Un choix sans sa raison sera défait par le premier qui le trouvera bizarre.

**Quand un doute revient deux fois, il manque un document.** L'écrire plutôt
que de le réexpliquer.

Après un travail conséquent, relire `docs/06-etat-et-suites.md` : ce qui a été
corrigé sort de la liste, ce qui a été découvert y entre, et la date en tête
change.

## Règles de travail sur ce projet

**Une seule source, deux rendus.** Jamais deux copies d'un écran ou d'un
libellé : elles divergent, et le bug se corrige d'un seul côté. Les libellés
affichés viennent de `lib/i18n/translations.ts` via `lib/lab-view.ts`. Les
libellés anglais de `lib/types.ts` servent aux prompts — les changer change ce
que le modèle comprend.

**Avant de supprimer un écran, chercher ce qu'il portait d'unique.** Deux fois
une fonctionnalité a failli disparaître en silence avec son écran. C'est le
piège le plus coûteux du projet.

**Aucune écriture n'échoue en silence.** Vérifier l'erreur de chaque écriture
applicative ; quand la colonne manque, nommer la migration.

**Le produit ne prédit pas.** Pas de probabilité de signature, pas d'impact
chiffré attendu. Ce qu'on affiche, c'est ce qui est établi et ce que l'action
débloque.

**Pas de score sans capture.** Un blanc est une information ; une réponse
inventée n'en est pas une.

**Les tests protègent les règles, pas le code.** Un test doit échouer si
quelqu'un réintroduit le défaut — pas simplement couvrir une ligne.
`npm run test:scoring`.

**Les migrations se donnent en SQL brut dans la réponse**, pas en chemin de
fichier : Pierre les colle dans le SQL Editor de Supabase.

**Répondre en français.** Le produit et son utilisateur sont français ; les
commentaires de code restent en anglais.
