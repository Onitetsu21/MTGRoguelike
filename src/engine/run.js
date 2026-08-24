// État de run (roguelike) — pur, sans React, testable en isolation.
// Enveloppe le combat (game.js) dans une boucle : draft → carte de run
// (combats / boutique / événements / boss) → victoire ou game over.
//
// Toutes les valeurs viennent de `content` (données JSON chargées ailleurs) :
//   content = { cardDb, balance, shop, encounters:{encounters,bosses}, levels, events }
// Les transitions publiques clonent l'état de run reçu et renvoient un nouvel état.

import { shuffle } from './rng.js';

export const COLORS = ['W', 'U', 'B', 'R', 'G'];

const clone = (run) => structuredClone(run);

// --- Tirage pondéré par rareté ---------------------------------------------

function weightedSample(entries, rng) {
  const total = entries.reduce((a, e) => a + e.w, 0);
  let r = rng() * total;
  for (const e of entries) {
    r -= e.w;
    if (r < 0) return e.id;
  }
  return entries[entries.length - 1].id;
}

// Tire n ids de cartes parmi `defs`, pondérés par rareté, sans remise par défaut.
export function randomCardIds(defs, n, weights, rng, distinct = true) {
  let pool = defs.map((d) => ({ id: d.id, w: weights?.[d.rarity] ?? 1 }));
  const out = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const id = weightedSample(pool, rng);
    out.push(id);
    if (distinct) pool = pool.filter((e) => e.id !== id);
  }
  return out;
}

const poolDefs = (content) => Object.values(content.cardDb);

// ---------------------------------------------------------------------------
// Création de run & navigation de carte
// ---------------------------------------------------------------------------

export function createRun(content, deck, rng = Math.random) {
  const b = content.balance.run;
  const run = {
    status: 'map', // drafting | map | combat | shop | event | defeat_reward | victory | game_over
    currentHp: b.starting_max_hp,
    maxHp: b.starting_max_hp,
    gold: b.starting_gold,
    manaCap: b.starting_mana_cap,
    manaCapUpgrades: 0,
    deck: [...deck],
    level: 0,
    map: null,
    position: null,
    visited: [],
    reachable: [],
    pending: null,
    log: [],
  };
  initLevel(run, content, 0);
  return run;
}

function initLevel(run, content, levelIndex) {
  const lvl = content.levels[levelIndex];
  run.level = levelIndex;
  run.map = {
    levelId: lvl.id,
    boss: lvl.boss,
    combatPool: [...lvl.combat_pool],
    eventPool: [...lvl.event_pool],
    rows: lvl.rows.map((r) => r.map((n) => ({ ...n }))),
    edges: lvl.edges.map((e) => [...e]),
  };
  run.position = null;
  run.visited = [];
  run.reachable = run.map.rows[0].map((n) => n.id);
  run.pending = null;
  run.status = 'map';
}

function nodeById(run, id) {
  for (const row of run.map.rows) {
    const n = row.find((x) => x.id === id);
    if (n) return n;
  }
  return null;
}

function leaveNode(run) {
  const outgoing = run.map.edges.filter((e) => e[0] === run.position).map((e) => e[1]);
  run.reachable = outgoing;
  run.pending = null;
  run.status = 'map';
}

const pickRandom = (arr, rng) => arr[Math.floor(rng() * arr.length)];

// Entrer dans un nœud accessible : prépare le contexte (pending) et l'écran.
export function enterNode(run, content, nodeId, rng = Math.random) {
  if (run.status !== 'map' || !run.reachable.includes(nodeId)) return run;
  const node = nodeById(run, nodeId);
  if (!node) return run;

  const r = clone(run);
  r.position = nodeId;
  r.visited.push(nodeId);

  if (node.type === 'combat') {
    r.status = 'combat';
    r.pending = { kind: 'combat', encounterId: pickRandom(r.map.combatPool, rng), isBoss: false };
  } else if (node.type === 'boss') {
    r.status = 'combat';
    r.pending = { kind: 'combat', bossId: r.map.boss, isBoss: true };
  } else if (node.type === 'shop') {
    r.status = 'shop';
    r.pending = { kind: 'shop', offers: buildShopOffers(r, content, rng) };
  } else if (node.type === 'event') {
    r.status = 'event';
    r.pending = { kind: 'event', eventId: pickRandom(r.map.eventPool, rng) };
  }
  return r;
}

// ---------------------------------------------------------------------------
// Pont run -> combat
// ---------------------------------------------------------------------------

// Construit l'objet `setup` attendu par createGame(cardDb, setup, rng).
export function buildCombatSetup(run, content) {
  const p = run.pending;
  const enc = p.isBoss ? content.encounters.bosses[p.bossId] : content.encounters.encounters[p.encounterId];
  const combat = content.balance.combat;
  return {
    playerDeck: run.deck,
    enemyDeck: enc.deck,
    playerHp: run.currentHp,
    playerMaxHp: run.maxHp,
    enemyHp: enc.hp,
    enemyMaxHp: enc.hp,
    playerManaCap: run.manaCap,
    enemyManaCap: combat.enemy_default_mana_cap,
    enemyName: enc.name,
    params: {
      startingHandSize: combat.starting_hand_size,
      extraDrawsMax: combat.extra_draws_max,
      extraDrawInterval: combat.extra_draw_interval,
    },
  };
}

// Applique le résultat d'un combat (result = { outcome, playerHpAfter }).
export function resolveCombat(run, content, result, rng = Math.random) {
  if (run.pending?.kind !== 'combat') return run;
  const r = clone(run);

  if (result.outcome === 'win') {
    r.currentHp = result.playerHpAfter;
    const rewards = content.balance.rewards;
    r.gold += r.pending.isBoss
      ? rewards.gold_boss_by_level[r.level]
      : rewards.gold_combat_by_level[r.level];

    if (r.pending.isBoss) {
      if (r.level >= content.levels.length - 1) {
        r.status = 'victory';
        r.pending = null;
      } else {
        initLevel(r, content, r.level + 1);
      }
    } else {
      leaveNode(r);
    }
    return r;
  }

  // Défaite de combat
  return applyDefeat(r, content, rng);
}

// Défaite : -20 PV max ; game over si ≤ 0, sinon lot de consolation + retry.
function applyDefeat(r, content, rng) {
  r.maxHp -= content.balance.run.combat_loss_maxhp_penalty;
  if (r.maxHp <= 0) {
    r.maxHp = 0;
    r.currentHp = 0;
    r.status = 'game_over';
    r.pending = null;
    return r;
  }
  r.currentHp = r.maxHp; // PV frais pour la nouvelle tentative
  r.pending = { ...r.pending, consolation: buildConsolationOffer(content, rng) };
  r.status = 'defeat_reward';
  return r;
}

function buildConsolationOffer(content, rng) {
  const { num_colors, num_choices } = content.balance.consolation;
  const colors = shuffle(COLORS, rng).slice(0, num_colors);
  const defs = poolDefs(content).filter((d) => (d.colors ?? []).some((c) => colors.includes(c)));
  const choices = randomCardIds(defs, num_choices, content.balance.draft.rarity_weights, rng);
  return { colors, choices };
}

// Choix du lot de consolation → carte ajoutée au deck, puis retry du combat.
export function pickConsolation(run, content, cardId) {
  if (run.status !== 'defeat_reward') return run;
  const r = clone(run);
  if (r.pending.consolation.choices.includes(cardId)) r.deck.push(cardId);
  delete r.pending.consolation;
  r.status = 'combat'; // retry de la même rencontre, PV déjà remis à maxHp
  return r;
}

// ---------------------------------------------------------------------------
// Boutique
// ---------------------------------------------------------------------------

function buildShopOffers(run, content, rng) {
  const shop = content.shop;
  const bal = content.balance;
  const defs = poolDefs(content);
  const cards = randomCardIds(defs, bal.shop.cards_offered, bal.draft.rarity_weights, rng).map(
    (id) => ({ cardId: id, price: shop.card_prices[content.cardDb[id].rarity] })
  );
  return {
    cards,
    booster: { price: shop.booster.price },
    manaCap:
      run.manaCap >= bal.run.mana_cap_hard_max
        ? null
        : { price: shop.mana_cap_upgrade.base_price + shop.mana_cap_upgrade.price_increment * run.manaCapUpgrades },
    heal: { hp: shop.heal.hp_per_purchase, price: shop.heal.price },
  };
}

export function buyShopCard(run, content, cardId) {
  if (run.pending?.kind !== 'shop') return run;
  const r = clone(run);
  const offers = r.pending.offers;
  const idx = offers.cards.findIndex((c) => c.cardId === cardId);
  if (idx < 0 || r.gold < offers.cards[idx].price) return run;
  r.gold -= offers.cards[idx].price;
  r.deck.push(cardId);
  offers.cards.splice(idx, 1);
  return r;
}

export function buyManaCap(run, content) {
  if (run.pending?.kind !== 'shop' || !run.pending.offers.manaCap) return run;
  const r = clone(run);
  const price = r.pending.offers.manaCap.price;
  if (r.gold < price || r.manaCap >= content.balance.run.mana_cap_hard_max) return run;
  r.gold -= price;
  r.manaCap += 1;
  r.manaCapUpgrades += 1;
  r.pending.offers = buildShopOffersPrices(r, content, r.pending.offers);
  return r;
}

// Recalcule seulement les prix dépendants de l'état (plafond de mana) sans re-tirer les cartes.
function buildShopOffersPrices(run, content, offers) {
  const shop = content.shop;
  const bal = content.balance;
  return {
    ...offers,
    manaCap:
      run.manaCap >= bal.run.mana_cap_hard_max
        ? null
        : { price: shop.mana_cap_upgrade.base_price + shop.mana_cap_upgrade.price_increment * run.manaCapUpgrades },
  };
}

export function buyHeal(run, content) {
  if (run.pending?.kind !== 'shop') return run;
  const r = clone(run);
  const { hp, price } = r.pending.offers.heal;
  if (r.gold < price || r.currentHp >= r.maxHp) return run;
  r.gold -= price;
  r.currentHp = Math.min(r.currentHp + hp, r.maxHp);
  return r;
}

export function buyBooster(run, content, rng = Math.random) {
  if (run.pending?.kind !== 'shop' || run.pending.boosterPick) return run;
  const r = clone(run);
  const price = r.pending.offers.booster.price;
  if (r.gold < price) return run;
  r.gold -= price;
  const choices = randomCardIds(
    poolDefs(content),
    content.shop.booster.cards_shown,
    content.balance.draft.rarity_weights,
    rng
  );
  r.pending.boosterPick = { choices, picks: content.shop.booster.picks };
  return r;
}

export function pickBoosterCard(run, cardId) {
  if (run.pending?.kind !== 'shop' || !run.pending.boosterPick) return run;
  const r = clone(run);
  const bp = r.pending.boosterPick;
  if (!bp.choices.includes(cardId)) return run;
  r.deck.push(cardId);
  bp.picks -= 1;
  if (bp.picks <= 0) delete r.pending.boosterPick;
  return r;
}

export function leaveShop(run) {
  if (run.status !== 'shop') return run;
  const r = clone(run);
  leaveNode(r);
  return r;
}

// ---------------------------------------------------------------------------
// Événements
// ---------------------------------------------------------------------------

export function applyEvent(run, content) {
  if (run.status !== 'event') return run;
  const r = clone(run);
  const ev = content.events[r.pending.eventId];
  if (ev.effect === 'heal') r.currentHp = Math.min(r.currentHp + ev.amount, r.maxHp);
  else if (ev.effect === 'mana_cap') r.manaCap = Math.min(r.manaCap + ev.amount, content.balance.run.mana_cap_hard_max);
  else if (ev.effect === 'gold') r.gold += ev.amount;
  leaveNode(r);
  return r;
}

// ---------------------------------------------------------------------------
// Draft initial
// ---------------------------------------------------------------------------

export function createDraft(content, rng = Math.random) {
  const d = content.balance.draft;
  const boosters = [];
  for (let i = 0; i < d.num_boosters; i++) {
    boosters.push(randomCardIds(poolDefs(content), d.booster_size, d.rarity_weights, rng));
  }
  return {
    boosters,
    boosterIndex: 0,
    picksLeft: d.picks_per_booster,
    picksPerBooster: d.picks_per_booster,
    picked: [],
    done: false,
  };
}

// Prend une carte du booster courant ; retire une carte de plus (simule le passage).
export function draftPick(draft, cardId, rng = Math.random) {
  if (draft.done) return draft;
  const s = structuredClone(draft);
  const booster = s.boosters[s.boosterIndex];
  const idx = booster.indexOf(cardId);
  if (idx < 0) return draft;

  booster.splice(idx, 1);
  s.picked.push(cardId);
  s.picksLeft -= 1;
  if (booster.length > 0) booster.splice(Math.floor(rng() * booster.length), 1); // passage

  if (s.picksLeft <= 0 || booster.length === 0) {
    s.boosterIndex += 1;
    s.picksLeft = s.picksPerBooster;
  }
  if (s.boosterIndex >= s.boosters.length) s.done = true;
  return s;
}

export function currentBooster(draft) {
  return draft.done ? [] : draft.boosters[draft.boosterIndex];
}
