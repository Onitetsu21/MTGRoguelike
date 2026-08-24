# Prompt Claude Code — Jalon 2 : MVP

## Contexte du projet

Roguelike de deckbuilding solo en React, inspiré de Magic: The Gathering, simplifié façon Mindbug/Hearthstone (pas de mana-terrain, pas de pile/priorité, pas d'instants). Le stack et les conventions sont dans `CLAUDE.md`, les règles complètes dans `docs/GAME_DESIGN.md` — **les lire avant de commencer**. Principe non négociable : **data-driven** (aucune valeur de gameplay en dur, tout vit dans `data/*.json`). Engine (`/src/engine`) pur, sans React ; composants (`/src/components`) rendu/interaction uniquement.

## Ce qui existe déjà (Jalon 1 — POC, validé)

Un **combat unique** complet et jouable :

- Moteur pur dans `/src/engine` : `createGame`, `playCard`, `attack`, `endTurn`, sélecteurs (`effectivePower`, `getAttackTargets`…), IA bot minimale, immutabilité (chaque action clone l'état).
- Mana 1→5, main 7 + 2 pioches suppl., jeu multi-cartes, **combat mutuel** (les deux créatures se frappent), **dégâts persistants** entre tours.
- Mots-clés : **Vol**, **Piétinement**, **Toucher mortel**.
- Ciblage asymétrique joueur/bot ; victoire (PV adverse 0) / défaite (PV joueur 0 ou main vide).
- Données dans `data/cards-poc.json` (+ `data/decks-poc.json`), chargées via `src/data/loadData.js`.
- UI : main, plateaux, mana/PV, ciblage au clic, journal, écran de fin. 12 tests moteur (Vitest).

Le combat du POC reste le cœur : le MVP **l'enveloppe** dans une boucle de run, il ne le réécrit pas.

## Objectif de cette phase (Jalon 2 — MVP)

Une **boucle de run complète** jouable de bout en bout : **draft → carte de run (3 niveaux, chemin à embranchements, nœuds combat/boutique/événement/boss) → victoire finale ou game over**, avec une **économie de boutique**, des **PV persistants sur 100** entre combats, et la **défaite de combat** (−20 PV max, retry, lot de consolation). Cible : un run se joue en 20-40 min.

### HORS scope (ne PAS implémenter — Jalon 3+)

Méta-progression inter-run (XP, niveaux, extensions débloquées) ; import Scryfall réel ; mécaniques Bloomburrow spécifiques (Renfort, Dépense, Vaillance, Fourrager, Don, Seuil, Percée, Rappel) ; règle de paiement Surcharge sur les éphémères ; génération aléatoire des boss par archétype (boss **fixes** ici) ; sauvegarde Supabase ; son ; animations poussées.

---

## Spécifications détaillées

### 1. Nouveaux mots-clés (moteur + tests)

S'ajoutent aux 3 du POC. Simples, testables en isolation.

- **Lien de vie (`lifelink`)** : quand une créature inflige des dégâts (à une créature OU au joueur adverse), son contrôleur gagne autant de **PV courants** (voir §2 pour le pool de PV en combat). Vaut aussi bien en attaque qu'en riposte.
- **Célérité (`haste`)** : la créature peut attaquer le tour où elle est jouée (ignore le mal d'invocation). Concrètement : `readyToAttack = true` dès l'arrivée sur le champ de bataille.
- **Portée (`reach`)** : une créature avec Portée peut **attaquer** une créature avec Vol (contre-jeu au Vol). Étend la règle `canBeAttackedBy` : une défenseure volante est attaquable si l'attaquante a `flying` **ou** `reach`.

Le lien de vie interagit avec l'économie de run : les PV gagnés en combat s'ajoutent aux PV courants du joueur, **plafonnés aux PV max** (voir §2). Pour le bot, le lien de vie soigne les PV de l'ennemi du combat en cours (borné à ses PV de départ de combat).

### 2. Combat dans le contexte d'un run (refonte légère)

Le combat garde toutes ses règles POC. Changements :

- **PV du joueur = PV courants du run** (pas un 20 fixe). Le combat démarre avec les PV courants actuels du joueur (ex. 73/100). Les dégâts subis **réduisent les PV courants** et **persistent après une victoire**.
- **PV de l'ennemi** : lus depuis la rencontre (config `encounters-poc.json`), pas un 20 fixe (normaux ~20-26, boss 30-45).
- **Deck du joueur** = le deck de run courant (construit au draft, modifié par boutique/consolation), remélangé au début de **chaque** combat.
- **Deck du bot** = celui de la rencontre.
- Le combat renvoie un **résultat** exploitable par la couche run : `{ outcome: 'win' | 'loss', playerHpAfter, goldReward }`. La règle de récompense d'or est en config (voir §6). Une victoire conserve `playerHpAfter` (PV courants réduits). Une défaite (PV courants à 0 **ou** main vide sans avoir tué l'ennemi) déclenche la procédure de défaite (§7).
- Paramètres de combat (main de départ, pioches suppl., mana de départ) lus depuis `balance-poc.json`.

L'API moteur du combat (`createGame`, etc.) est adaptée pour recevoir : deck joueur, PV courants joueur, rencontre (deck + PV ennemi), et paramètres de combat. Garder l'engine pur et testable.

### 3. État de run (nouveau module moteur)

Un module `/src/engine/run.js` (pur, sans React) gère l'état de run, séparé de l'état de combat :

```
RunState {
  status: 'drafting' | 'map' | 'combat' | 'shop' | 'event' | 'defeat_reward' | 'victory' | 'game_over',
  currentHp, maxHp,        // PV courants / max (départ 100/100)
  gold,                    // départ 0
  manaCap,                 // plafond de mana du run (départ 5, ↑ en boutique)
  deck: [cardId, ...],     // deck de run (liste d'ids, dupliquables)
  level: 0,                // niveau courant (0..2)
  mapPosition,             // nœud courant sur la carte du niveau
  map,                     // carte du niveau courant (nœuds + arêtes, cf §5)
  pendingCombat,           // rencontre en cours le cas échéant
  rng seed / log
}
```

Transitions pures : `startRun(draftedDeck)`, `enterNode(nodeId)`, `resolveCombatResult(result)`, `applyDefeat()`, `buyFromShop(...)`, `pickConsolation(cardId)`, `advanceLevel()`, etc. Aucune règle en dur : PV de départ, pénalité de défaite, prix, récompenses → configs.

### 4. Draft initial

Écran de draft avant le run. Config `balance-poc.json » draft` :

```json
"draft": { "num_boosters": 4, "booster_size": 8, "picks_per_booster": 3 }
```

- Ouvre `num_boosters` boosters successifs de `booster_size` cartes tirées aléatoirement du pool (`cards-poc.json`), pondérées par rareté (les communes plus fréquentes).
- Dans chaque booster, le joueur prend `picks_per_booster` cartes **une à la fois** ; après chaque pick, une autre carte du booster est retirée (simule le passage entre drafteurs). Quand le booster est épuisé, on passe au suivant.
- Résultat : deck de départ de `num_boosters × picks_per_booster` = **12 cartes**.
- Pondération de rareté du tirage : config (`draft.rarity_weights`).

### 5. Carte de run (façon Slay the Spire)

3 niveaux. Chaque niveau = une carte à embranchements définie en **data** (`run-map-poc.json`), terminée par un **boss fixe**.

Structure d'un niveau :

```json
{
  "id": 1,
  "boss": "warren_matriarch",
  "rows": [
    [{ "id": "1a", "type": "combat" }],
    [{ "id": "2a", "type": "combat" }, { "id": "2b", "type": "event" }],
    [{ "id": "3a", "type": "shop" }, { "id": "3b", "type": "combat" }],
    [{ "id": "boss", "type": "boss" }]
  ],
  "edges": [["1a","2a"],["1a","2b"],["2a","3a"],["2a","3b"],["2b","3b"],["3a","boss"],["3b","boss"]],
  "combat_pool": ["aggro_red", "flyers_blue", "midrange_green"],
  "event_pool": ["healing_spring", "wandering_merchant"]
}
```

- Types de nœuds : `combat`, `shop`, `event`, `boss`.
- Le joueur avance de rangée en rangée en suivant les arêtes (choix de chemin).
- Un nœud `combat` tire une rencontre au hasard dans `combat_pool` ; `event` tire dans `event_pool`.
- Battre le boss → niveau suivant (`advanceLevel`) ; battre le boss du niveau 3 → **victoire**.

### 6. Boutique & économie

Config `shop-config.json` :

```json
{
  "card_prices": { "common": 40, "uncommon": 75, "rare": 120 },
  "booster": { "price": 60, "cards_shown": 3, "picks": 1 },
  "mana_cap_upgrade": { "base_price": 80, "price_increment": 40 },
  "heal": { "hp_per_purchase": 10, "price": 30 }
}
```

- **Acheter une carte** : la boutique propose N cartes aléatoires (config `shop.cards_offered`), prix par rareté, ajoutée au deck.
- **Booster** : ouvre `cards_shown` cartes, en garde `picks`, ajoutées au deck.
- **+1 plafond de mana** : prix montant (`base_price + price_increment × (achats déjà faits)`), borné par `balance-poc.json » run.mana_cap_hard_max`.
- **Soin** : `hp_per_purchase` PV courants pour `price` (borné aux PV max).
- **Or** : gagné en gagnant les combats. Config `balance-poc.json » rewards` (par niveau + bonus boss). Départ 0.

### 7. Défaite de combat, consolation, game over

- Perdre un combat (PV courants 0 **ou** main vide) → **`maxHp −= run.combat_loss_maxhp_penalty` (20)**. Si `maxHp ≤ 0` → **game over**.
- Sinon : **lot de consolation** — tirer `consolation.num_colors` (2) couleurs au hasard parmi les 5 ; proposer `consolation.num_choices` (3) cartes de ces couleurs, le joueur en choisit **1**, ajoutée au deck.
- Puis **retry** possible du même combat (PV courants remis à `maxHp` pour la tentative). Chaque nouvel échec recoûte 20 PV max.
- **Game over** → écran dédié + restart (nouveau draft).
- **Victoire finale** (boss niveau 3 battu) → écran de victoire + restart.

### 8. Écrans & flux

`Titre → Draft → Carte (niv.1) → [nœuds] → Boss → Carte (niv.2) → … → Boss niv.3 → Victoire`
avec branches `Défaite combat → consolation → retry`, et `Game over → Titre`.

- **Écran titre** : nouveau run.
- **HUD run** permanent hors combat : PV courants/max, or, plafond de mana, taille de deck, niveau.
- Réutiliser les composants de combat du POC.
- Écrans : Draft, Carte de run, Boutique, Événement, Défaite/consolation, Victoire, Game over.

---

## Fichiers de données (à créer / étendre)

- `data/cards-poc.json` — **étendu à ~30 cartes** (fourni séparément), avec champ `colors` (`["W"|"U"|"B"|"R"|"G"]`) et les nouveaux mots-clés. Schéma inchangé sinon.
- `data/encounters-poc.json` — rencontres normales (id, nom, `hp`, `deck: [cardId…]`) + 3 boss.
- `data/run-map-poc.json` — les 3 niveaux (structure §5).
- `data/shop-config.json` — prix (§6).
- `data/balance-poc.json` — knobs centraux :

```json
{
  "run": { "starting_max_hp": 100, "starting_gold": 0, "starting_mana_cap": 5, "mana_cap_hard_max": 8, "combat_loss_maxhp_penalty": 20 },
  "combat": { "starting_hand_size": 7, "mana_start": 1, "extra_draws_max": 2, "extra_draw_interval": 2 },
  "draft": { "num_boosters": 4, "booster_size": 8, "picks_per_booster": 3, "rarity_weights": { "common": 6, "uncommon": 3, "rare": 1 } },
  "shop": { "cards_offered": 4 },
  "consolation": { "num_colors": 2, "num_choices": 3 },
  "rewards": { "gold_combat_by_level": [30, 40, 55], "gold_boss_by_level": [60, 80, 110] }
}
```

`data/decks-poc.json` du POC est remplacé par les decks de `encounters-poc.json` (le deck joueur vient désormais du draft).

## Architecture

- Nouveau module pur `/src/engine/run.js` (état + transitions de run), séparé du combat. Aucun import React.
- Le combat existant est adapté pour recevoir deck/PV/rencontre en paramètres (rester pur et testable).
- `/src/components` : un composant par écran (Draft, RunMap, Shop, Event, résultats), + réutilisation des composants de combat. Aucune règle de jeu dans les composants.
- `src/data/loadData.js` étendu pour charger les nouvelles configs et les exposer au run.
- Un hook `useRun` (façon `useGame`) orchestre l'état de run côté React.

## Découpage recommandé (livraison par morceaux)

- **MVP-A** — Données (30 cartes + 4 configs) ; nouveaux mots-clés moteur + tests ; module `run.js` (état/PV/or/deck) ; combat paramétré par le run + résultat.
- **MVP-B** — Draft (écran + logique) → deck de départ.
- **MVP-C** — Écran titre + carte de run (nœuds, embranchements, navigation) + flux d'écrans.
- **MVP-D** — Boutique + économie d'or + événement simple.
- **MVP-E** — Défaite/consolation/retry + victoire + game over + HUD complet + 1re passe de balance.

## Critères de validation (gates Jalon 2)

- [ ] Un run complet (draft → 3 niveaux → victoire ou game over) est jouable de bout en bout sans bug bloquant, en 20-40 min.
- [ ] Les PV persistent entre combats ; la défaite de combat retire bien 20 PV max, propose le lot de consolation (1 carte parmi 3 dans 2 couleurs) et permet de retenter.
- [ ] La boutique fonctionne (cartes, booster, +plafond mana, soin) avec une économie d'or cohérente.
- [ ] Le draft construit un deck de 12 cartes ; le deck de run évolue (boutique/consolation).
- [ ] Les nouveaux mots-clés (Lien de vie, Célérité, Portée) fonctionnent et sont testés.
- [ ] Aucune valeur de gameplay en dur — tout vient des JSON.
- [ ] Plusieurs runs testés, ressenti « on continue » confirmé.
