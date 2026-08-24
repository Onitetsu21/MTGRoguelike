# Prompt Claude Code — Jalon 3 : Alpha

## Contexte du projet

Roguelike de deckbuilding solo en React, MTG simplifié façon Mindbug/Hearthstone (pas de mana-terrain, pas de pile/priorité, pas d'instants). Stack & conventions dans `CLAUDE.md` ; règles dans `docs/GAME_DESIGN.md` — **à lire avant de commencer**. Principe non négociable : **data-driven** (tout le gameplay dans `data/*.json`). Engine (`/src/engine`) pur, sans React ; composants (`/src/components`) rendu/interaction uniquement.

## Ce qui existe déjà (Jalons 1-2, validés)

- **Combat** (POC) : mana 1→cap, main 7 + pioches suppl., combat mutuel, dégâts persistants, ciblage asymétrique, garde-fou de tours. Mots-clés : Vol, Piétinement, Toucher mortel, Lien de vie, Célérité, Portée.
- **Boucle de run** (MVP) : draft (4 boosters × 3 picks → 12 cartes), carte de run à embranchements (combat/boutique/événement/boss), 3 niveaux + boss fixes, PV persistants sur 100, défaite −20 PV max + consolation + retry, boutique, événements, victoire/game over.
- **Moteur** : `game.js` (combat), `run.js` (état de run), `selectors.js`, tout piloté par `content` (`src/data/loadData.js`). Effets de rituel actuels : `deal_damage`, `buff`. Rendu : écrans React + `useRun`. ~41 tests, sim headless.
- **Données** : `cards-poc.json` (30 cartes test), `encounters/run-map/shop/events/balance-poc.json`.

L'Alpha **étend** ces fondations, il ne les réécrit pas.

## Objectif (Jalon 3 — Alpha, un seul jalon)

Jeu **feature-complete** avec le vrai contenu Bloomburrow (approche **hybride**), toutes les mécaniques retenues, génération de boss par archétype, et **méta-progression** persistée en **localStorage**. Pas encore poli.

### Décisions de cadrage déjà prises

- **Contenu = hybride** : script Scryfall importe stats/mots-clés/couleurs/rareté des vraies cartes Bloomburrow → `cards-bloomburrow.json` ; les cartes-**signaux d'archétype** (porteuses de mécanique) sont réécrites à la main via notre schéma de capacités. Les cartes hors vocabulaire deviennent vanille + mots-clés.
- **Persistance = localStorage** (Supabase repoussé en Beta).
- **Alpha = un seul jalon** (un prompt, une PR), implémenté en étapes internes 3-A…3-F.

### HORS scope (Beta+)

Supabase / sync cross-device ; import de l'oracle text complet (capacités arbitraires) ; capacités **activées** génériques (on se limite aux mécaniques ci-dessous) ; polish UI/animations, tutoriel, musique ; 2ᵉ extension.

---

## Spécifications détaillées

### 3-A. Cadre de capacités/effets (moteur)

Généralise le système d'effets. Une carte peut porter des **capacités** :

```json
"abilities": [
  { "trigger": "on_enter", "effect": { "type": "create_token", "power": 1, "toughness": 1, "count": 1 } },
  { "trigger": "on_attack", "condition": { "kind": "threshold", "min": 7 }, "effect": { "type": "buff", "power": 2, "toughness": 0, "duration": "turn", "target": "self" }, "limit_per_turn": 1 }
]
```

**Triggers supportés** (vocabulaire fermé) :
- `cast` — à la résolution de la carte (rituels ; remplace l'`effect` legacy, rétro-compatible).
- `on_enter` — arrivée d'une créature (ETB).
- `on_attack` — quand la créature attaque.
- `on_death` — quand la créature meurt.
- `on_spell_cast` — quand le contrôleur joue un rituel (Izzet/Prowess, Dépense).
- `on_mana_tier` — début de tour quand `maxMana` augmente (Percée).
- `on_targeted_by_own` — une créature contrôlée est ciblée par un sort/capacité du contrôleur (Vaillance).
- `static` — effet continu tant que la source est en jeu (anthem Azorius…).

**Vocabulaire d'effets** (fermé, extensible par data) :
`deal_damage`, `buff` (power/toughness, duration turn|permanent), `gain_life`, `create_token` (power/toughness/keywords/count/food?), `destroy`, `draw` (count), `grant_keyword` (keyword/duration), `anthem` (static : buff filtré, ex. « vos non-volants +1/+1 »).

**Champs communs** : `condition` (optionnel : `threshold` graveyard≥N, `expend` mana dépensé≥N…), `target` (`self` | `chosen_creature` | `chosen_any` | `enemy_face` | `all_allies`…), `limit_per_turn`.

Résolution : un moteur d'effets applique `effect` selon `type`/`target` ; les triggers sont émis par les points existants du combat (jeu de carte, attaque, mort, début de tour). Le **bot auto-cible** ses effets (heuristique simple : meilleure cible). Rester pur/testable.

**Évergreens restants** à ajouter (simples) : Vigilance (n/a sans tap → on l'ignore ou on lui donne un sens : « peut attaquer même après avoir bloqué » — pas de blocage ici, donc **on ne retient pas Vigilance/Menace pour l'Alpha**), **Initiative** (premier frappe : inflige ses dégâts avant la riposte ; si la cible meurt, pas de riposte), **Indestructible** (ne meurt pas des dégâts ; ignore Toucher mortel). → Alpha ajoute **Initiative** et **Indestructible** ; Vigilance/Menace notées non-portables (documenté).

### 3-B. Mécaniques Bloomburrow

Toutes exprimées via le cadre 3-A + quelques états de combat nouveaux (`manaSpentThisTurn`, zone `exile`, jetons `Food`, `nextTurnManaPenalty`, compteurs de trigger/tour). Le **cimetière devient mécanique** (compté pour Seuil, source pour Fourrager/Rappel).

- **Renfort (Offspring N)** : coût additionnel optionnel à l'invocation ; si payé, `on_enter` → `create_token` copie 1/1 de la créature. Choix joueur au cast ; bot paie si abordable.
- **Dépense (Expend N)** : `on_spell_cast` + `condition: expend N` (compteur `manaSpentThisTurn`), se déclenche au franchissement du seuil.
- **Vaillance (Valiant)** : `on_targeted_by_own`, `limit_per_turn: 1`.
- **Fourrager (Forage)** : coût alternatif d'une capacité — exiler 3 cartes du cimetière **ou** sacrifier un jeton Food. (Food = jeton créé par certaines cartes ; sacrifiable.)
- **Don (Gift)** : coût additionnel optionnel donnant un bonus à l'adversaire (jeton/vie/pioche) contre un effet amélioré. Bot reçoit sans choix.
- **Seuil (Threshold)** : `condition: threshold min:7` (cartes au cimetière).
- **Percée (Landfall)** : `on_mana_tier`.
- **Rappel (Flashback)** : propriété `flashback_cost` ; action moteur « jouer depuis le cimetière » (coût alt.), puis exil.
- **Surcharge** (éphémères→rituels, flag `overload: true`) : choix au cast — payer `cost+1`, **ou** payer `cost` et **hypothéquer** 1 de plafond de mana au tour suivant (plancher 1). État `nextTurnManaPenalty`.

### 3-C. Contenu — import hybride Bloomburrow

- **`scripts/fetch-cards.mjs`** (Node, dev-time, hors runtime) : récupère le set Bloomburrow via l'API Scryfall (données en bloc), filtre hors-terrains, extrait `id/name(FR)/mana value/colors/power/toughness/rarity/évergreens détectés` → **`data/cards-bloomburrow.json`**. Mots-clés évergreens supportés mappés automatiquement ; oracle non supporté ignoré (carte → vanille + mots-clés). Tag `archetypes` par paire de couleurs.
- **`data/cards-bloomburrow-overrides.json`** : cartes-**signaux** réécrites à la main avec `abilities` (une poignée par archétype). Fusionné au chargement par-dessus l'import auto (rejouer l'import n'écrase pas les overrides).
- **10 archétypes** tagués (cf. mapping `GAME_DESIGN.md`), draftables. Draft : garder 4×3=12 (ajustable), pool = Bloomburrow.

### 3-D. Génération de boss par archétype

- `data/archetypes.json` : par archétype → couleurs, mécanique, cartes-signaux, pool de cartes éligibles.
- `data/boss-gen.json` : par niveau → PV, taille de deck, biais de rareté. Boss 1 & 2 = archétype aléatoire → deck construit depuis son pool ; boss final = agrégat des meilleures cartes synergiques (archétype fort ou curation). Remplace les boss fixes du MVP.

### 3-E. Méta-progression (localStorage)

- **XP** gagnée en fin de run (gagné **ou** perdu) : `base + bonus par boss battu + bonus par niveau atteint` (config `meta.json`).
- **Niveaux** via courbe d'XP (config). Chaque niveau octroie **1 point de méta**.
- **Écran méta** (au titre) : dépenser les points sur un petit arbre d'améliorations (config, coûts croissants) : `+1 plafond de mana de départ`, `+1 carte de main de départ`, `+1 pioche suppl./combat (base 1 → max 3)`, `+X or de départ`.
- **Bases combat alignées au doc** : main 7, **pioches suppl. base = 1** (méta → 3 ; ⚠️ change la balance MVP qui était à 2), plafond mana 5, or 0. Toutes appliquées au démarrage d'un run depuis l'état méta.
- **Persistance localStorage** : état méta (XP, niveau, points, améliorations achetées) + **reprise d'une run en cours** (sauver `RunState` à chaque transition, proposer « Reprendre » au titre). Sérialisation JSON ; versionnée pour tolérer les évolutions de schéma.
- Extensions : une seule (Bloomburrow) → pas de déblocage multi-extension pour l'instant (juste marquer l'extension « terminée » au 1er run gagné).

### 3-F. 2ᵉ passe de balance + son placeholder

- Rééquilibrage avec le nouveau contenu (surveiller Sélesnya/Lapins, signalé fort). Guidé par la sim headless étendue au nouveau contenu.
- **SFX placeholder** : Web Audio minimal (bips oscillateur) pour jeu de carte / attaque / victoire / défaite, + un toggle son. Aucun asset externe.

---

## Fichiers de données (créer / étendre)

- `data/cards-bloomburrow.json` (généré) + `data/cards-bloomburrow-overrides.json` (manuel).
- `data/archetypes.json`, `data/boss-gen.json`, `data/meta.json` (courbe XP, arbre d'améliorations).
- `balance-poc.json` → renommer/compléter en `balance.json` (base pioches=1, etc.).
- Schéma carte étendu : `abilities`, `overload`, `flashback_cost`, `offspring_cost`, `archetypes`, `token` (pour les jetons).

## Architecture

- Nouveau `src/engine/effects.js` (moteur d'effets pur) + `src/engine/abilities.js` (émission/résolution des triggers) ; `game.js` émet les triggers aux points clés.
- `src/engine/meta.js` (pur) : état méta, gains d'XP, achats d'améliorations, application au démarrage de run.
- `src/data/persistence.js` : lecture/écriture localStorage (méta + run en cours), avec `try/catch` et version de schéma.
- Composants : `MetaScreen`, `ArchetypeDraftScreen` (ou réutilise le draft), indicateurs de mécaniques sur les cartes. Aucune règle de jeu dans les composants.
- `scripts/fetch-cards.mjs` isolé, jamais importé par le runtime.

## Critères de validation (gates Jalon 3)

- [ ] Toutes les mécaniques de `GAME_DESIGN.md` retenues sont implémentées et testées (unitaires par mécanique).
- [ ] Les 10 archétypes sont draftables et se sentent distincts sur 10+ runs.
- [ ] Boss générés par archétype, difficulté croissante.
- [ ] Méta-progression : XP en fin de run, niveaux, améliorations achetables persistées ; une run en cours est reprenable après rechargement.
- [ ] Import Scryfall reproductible via `npm run fetch-cards` ; le jeu tourne 100 % hors-ligne ensuite.
- [ ] Aucune valeur de gameplay en dur ; build + tests verts ; sim headless sans blocage.

## Points [OUVERT] — défauts proposés (à valider)

- **Vigilance/Menace** non portées (pas de tap/blocage) — Initiative + Indestructible ajoutés à la place.
- **Capacités activées génériques** repoussées (Beta) — seules les mécaniques listées sont implémentées.
- **Arbre de méta** : 4 améliorations ci-dessus, coûts croissants en points ; contenu exact ajustable.
- **Draft/deck** : inchangé (4×3=12).
- **Surcharge** : plancher de plafond de mana au tour suivant = 1.
- **XP** : gagnée même en défaite (montant moindre).
