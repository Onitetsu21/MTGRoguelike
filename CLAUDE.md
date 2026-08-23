# CLAUDE.md — Roguelike Magic simplifié

Instructions persistantes pour Claude Code sur ce projet. Ce fichier est lu automatiquement en début de session — le tenir à jour, le garder court, et renvoyer vers `docs/GAME_DESIGN.md` pour le détail plutôt que de tout dupliquer ici.

## En une phrase

Un roguelike de deckbuilding solo, en React, où le combat reprend l'ADN de Magic: The Gathering (créatures, mots-clés, couleurs) mais simplifié façon Mindbug/Hearthstone : pas de mana à payer en terrain, pas de pile/priorité, pas d'instants.

## Documentation complète

Toutes les règles de jeu (combat, économie intra-run, méta-progression, mots-clés retenus et adaptés, mapping des 10 archétypes Bloomburrow) sont dans **`docs/GAME_DESIGN.md`**. Le lire avant toute implémentation touchant au gameplay. Ce fichier-ci (CLAUDE.md) ne contient que le stack technique et les conventions de code.

## Stack technique

- **React**, pas de moteur de jeu (Phaser/PixiJS) — un jeu de cartes au tour par tour est fondamentalement de l'UI, pas du temps réel. Un moteur canvas n'apporterait rien ici.
- Animations : CSS / Framer Motion. Pas de rendu canvas.
- Persistance :
  - **Supabase** pour tout ce qui est méta-progression (XP, niveaux, extensions débloquées) — doit survivre entre sessions et appareils.
  - State React (+ `localStorage` si besoin de reprendre une run interrompue) pour l'état d'une run en cours.
- **Aucun appel à l'API Scryfall pendant le jeu.** Les données de cartes sont pré-générées hors-ligne en JSON par un script séparé (`scripts/fetch-cards.*`, à écrire quand on attaquera l'import réel de Bloomburrow). Le jeu ne dépend jamais du réseau pour fonctionner.

## Principe non négociable : data-driven

Aucune valeur de gameplay (coûts, Force/Endurance, texte de carte, mots-clés, courbes d'XP, prix en boutique...) ne doit être en dur dans le code. Tout vit dans `data/*.json`, chargé au runtime. Un changement de valeur doit être possible en éditant le JSON, sans toucher au code.

## Structure de dossiers

```
/src
  /components   composants React (Carte, Main, Plateau, HUD...) — rendu et interaction uniquement
  /engine       logique de jeu pure (mana, pioche, résolution de combat, victoire/défaite) — pas de React, testable seul
  /data         chargement et typage des fichiers JSON
/data
  cards-poc.json          cartes de test (jalon POC, pas de vraies cartes Magic)
  cards-bloomburrow.json  import réel Bloomburrow (plus tard)
/docs
  GAME_DESIGN.md          règles complètes du jeu — source de vérité
/scripts
  fetch-cards.*           script de pré-génération JSON depuis Scryfall (plus tard)
```

## Conventions

- Logique de jeu (`/engine`) strictement séparée du rendu (`/components`) : l'engine ne doit jamais importer React.
- IDs de cartes en snake_case anglais (`sparrow_scout`), noms affichés en français dans les champs `name`/`text`.
- Un fichier JSON par extension de cartes, jamais un fichier monolithe pour tout le pool.
- Chaque jalon de développement (POC, MVP, Alpha...) correspond à un prompt Claude Code dédié dans `docs/prompts/` — ne pas anticiper les systèmes des jalons suivants tant que le jalon en cours n'est pas validé.

## Confidentialité

Projet personnel utilisant de vraies données/cartes Magic (via Scryfall) — jamais déployé sur une URL publique. Développement en local uniquement pour l'instant.
