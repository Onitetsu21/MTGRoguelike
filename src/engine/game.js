// Cœur du moteur de combat.
// Aucun import React : ce module est testable indépendamment de l'interface.
//
// Jalon 2 : combat paramétré par le run (deck, PV, rencontre, plafond de mana).
// Jalon 3 : capacités/effets data-driven via abilities.js (triggers émis ici),
// mots-clés Initiative & Indestructible, cimetière mécanique.
//
// Convention : les fonctions publiques (createGame, playCard, attack, endTurn)
// ne modifient jamais l'état reçu ; elles renvoient un nouvel état (clone).

import {
  STARTING_HP,
  MANA_CAP,
  STARTING_HAND_SIZE,
  MAX_EXTRA_DRAWS,
  EXTRA_DRAW_INTERVAL,
  KEYWORDS,
  CARD_TYPES,
  TRIGGERS,
} from './constants.js';
import { buildDeck } from './deck.js';
import { pickRandom } from './rng.js';
import { triggerEvent, resolveCast } from './abilities.js';
import {
  effectivePower,
  effectiveToughness,
  remainingToughness,
  isDead,
  hasKeyword,
  canBeAttackedBy,
} from './selectors.js';

const clone = (state) => structuredClone(state);
const label = (player) => (player === 'player' ? 'Vous' : 'Le bot');

function log(state, text) {
  state.log.push({
    turn: state.players[state.activePlayer]?.turnsTaken ?? 0,
    actor: state.activePlayer,
    text,
  });
}

function newPlayerState(deck, { hp, maxHp, manaCap }) {
  return {
    hp,
    maxHp,
    manaCap,
    mana: 0,
    maxMana: 0,
    turnsTaken: 0,
    extraDraws: 0,
    manaSpentThisTurn: 0,
    hand: [],
    deck,
    graveyard: [],
    board: [],
  };
}

// Transforme une instance de carte (main) en créature posée sur le champ de bataille.
export function makeBoardCreature(card, controller) {
  const keywords = [...(card.keywords ?? [])];
  return {
    instanceId: card.instanceId,
    cardId: card.cardId,
    name: card.name,
    controller,
    keywords,
    grantedKeywords: [],
    abilities: (card.abilities ?? []).map((a) => structuredClone(a)),
    abilityUses: {},
    basePower: card.power,
    baseToughness: card.toughness,
    markedDamage: 0,
    tempBuffs: [],
    // Mal d'invocation, sauf Célérité qui permet d'attaquer immédiatement.
    readyToAttack: keywords.includes(KEYWORDS.HASTE),
    hasAttacked: false,
  };
}

// Réduit une créature détruite / un rituel joué en une carte pour le cimetière.
function toGraveyardCard(entity) {
  return {
    instanceId: entity.instanceId,
    cardId: entity.cardId,
    name: entity.name,
    controller: entity.controller,
  };
}

function drawCards(state, player, n) {
  const p = state.players[player];
  let drawn = 0;
  for (let i = 0; i < n; i++) {
    if (p.deck.length === 0) break;
    p.hand.push(p.deck.pop());
    drawn++;
  }
  return drawn;
}

// Gain de PV (Lien de vie, soins…), borné aux PV max du joueur concerné.
function gainHp(state, player, amount) {
  if (amount <= 0) return;
  const p = state.players[player];
  p.hp = Math.min(p.hp + amount, p.maxHp);
}

// --- Primitives utilisées par le moteur d'effets (deps injectées) -----------

function addBuff(creature, power, toughness, permanent) {
  creature.tempBuffs.push(permanent ? { power, toughness, permanent: true } : { power, toughness });
}

function grantKeyword(creature, keyword, permanent) {
  creature.grantedKeywords ??= [];
  creature.grantedKeywords.push(permanent ? { keyword, permanent: true } : { keyword });
}

function createToken(state, controller, spec, count = 1) {
  for (let i = 0; i < count; i++) {
    state.tokenCounter = (state.tokenCounter ?? 0) + 1;
    const keywords = [...(spec.keywords ?? [])];
    state.players[controller].board.push({
      instanceId: `token-${controller}-${state.tokenCounter}`,
      cardId: spec.cardId ?? 'token',
      name: spec.name ?? 'Jeton',
      controller,
      keywords,
      grantedKeywords: [],
      abilities: (spec.abilities ?? []).map((a) => structuredClone(a)),
      abilityUses: {},
      basePower: spec.power ?? 1,
      baseToughness: spec.toughness ?? 1,
      markedDamage: 0,
      tempBuffs: [],
      readyToAttack: keywords.includes(KEYWORDS.HASTE),
      hasAttacked: false,
      isToken: true,
    });
  }
}

function destroyCreature(state, creature) {
  if (hasKeyword(creature, KEYWORDS.INDESTRUCTIBLE)) return; // survit à « détruire »
  creature.markedDamage = effectiveToughness(creature) + 1e9;
}

function damageCreature(state, creature, amount, deathtouch) {
  if (amount <= 0) return;
  creature.markedDamage += amount;
  if (deathtouch) {
    // Toucher mortel : tout dégât ≥ 1 est létal (sauf Indestructible, géré par isDead).
    creature.markedDamage = Math.max(creature.markedDamage, effectiveToughness(creature));
  }
}

// Objet de dépendances passé au moteur de capacités (abilities.js).
const deps = { damageCreature, gainHp, drawCards, addBuff, grantKeyword, createToken, destroyCreature, log };

// ---------------------------------------------------------------------------
// Création de partie
// ---------------------------------------------------------------------------

export function createGame(cardDb, setup, rng = Math.random) {
  const {
    playerDeck,
    enemyDeck,
    playerHp = STARTING_HP,
    playerMaxHp = playerHp,
    enemyHp = STARTING_HP,
    enemyMaxHp = enemyHp,
    playerManaCap = MANA_CAP,
    enemyManaCap = MANA_CAP,
    enemyName = 'Adversaire',
    params = {},
  } = setup;

  const rules = {
    startingHandSize: params.startingHandSize ?? STARTING_HAND_SIZE,
    extraDrawsMax: params.extraDrawsMax ?? MAX_EXTRA_DRAWS,
    extraDrawInterval: params.extraDrawInterval ?? EXTRA_DRAW_INTERVAL,
    maxTurns: params.maxTurns ?? Infinity, // garde-fou anti-blocage
  };

  const state = {
    status: 'playing', // 'playing' | 'victory' | 'defeat'
    activePlayer: 'player',
    enemyName,
    rules,
    tokenCounter: 0,
    players: {
      player: newPlayerState(buildDeck(playerDeck, cardDb, 'player', rng), {
        hp: playerHp,
        maxHp: playerMaxHp,
        manaCap: playerManaCap,
      }),
      bot: newPlayerState(buildDeck(enemyDeck, cardDb, 'bot', rng), {
        hp: enemyHp,
        maxHp: enemyMaxHp,
        manaCap: enemyManaCap,
      }),
    },
    log: [],
  };

  drawCards(state, 'player', rules.startingHandSize);
  drawCards(state, 'bot', rules.startingHandSize);
  log(state, `Le combat commence — chaque camp pioche ${rules.startingHandSize} cartes.`);

  startTurn(state, 'player');
  return state;
}

// ---------------------------------------------------------------------------
// Gestion des tours
// ---------------------------------------------------------------------------

function startTurn(state, player) {
  const p = state.players[player];
  state.activePlayer = player;
  p.turnsTaken += 1;

  // Mana : +1 par tour, plafonné par le plafond du camp.
  const prevMax = p.maxMana;
  p.maxMana = Math.min(p.turnsTaken, p.manaCap);
  p.mana = p.maxMana;
  p.manaSpentThisTurn = 0;

  // Réveil des créatures + reset des compteurs de capacités par tour.
  for (const c of p.board) {
    c.readyToAttack = true;
    c.hasAttacked = false;
    c.abilityUses = {};
  }

  // Pioche supplémentaire tous les N tours (tours 3, 5, ...), plafonnée.
  if (
    p.turnsTaken >= 3 &&
    (p.turnsTaken - 1) % state.rules.extraDrawInterval === 0 &&
    p.extraDraws < state.rules.extraDrawsMax
  ) {
    const drawn = drawCards(state, player, 1);
    if (drawn > 0) {
      p.extraDraws += 1;
      log(state, `${label(player)} pioche une carte (pioche ${p.extraDraws}/${state.rules.extraDrawsMax}).`);
    }
  }

  log(state, `Tour ${p.turnsTaken} de ${label(player)} — ${p.mana} mana.`);

  // Percée : un nouveau palier de mana a été atteint.
  if (p.maxMana > prevMax) triggerEvent(state, deps, TRIGGERS.ON_MANA_TIER, { controller: player });
  cleanupDeaths(state);
}

// Fin du tour d'un joueur : buffs/keywords temporaires expirent (les permanents restent).
function expireTemporaryBuffs(state, player) {
  for (const c of state.players[player].board) {
    if (c.tempBuffs?.length) c.tempBuffs = c.tempBuffs.filter((b) => b.permanent);
    if (c.grantedKeywords?.length) c.grantedKeywords = c.grantedKeywords.filter((g) => g.permanent);
  }
  cleanupDeaths(state); // une baisse d'endurance peut être létale
}

// ---------------------------------------------------------------------------
// Combat & résolution
// ---------------------------------------------------------------------------

// Une créature frappe une autre (dégâts + Lien de vie + Piétinement).
function dealCombatBlow(state, attacker, defender) {
  const power = effectivePower(attacker);
  const deathtouch = hasKeyword(attacker, KEYWORDS.DEATHTOUCH);
  const healthBefore = remainingToughness(defender);
  const lethalNeeded = deathtouch ? Math.min(1, healthBefore) : healthBefore;

  damageCreature(state, defender, power, deathtouch);
  if (hasKeyword(attacker, KEYWORDS.LIFELINK)) gainHp(state, attacker.controller, power);
  if (hasKeyword(attacker, KEYWORDS.TRAMPLE) && isDead(defender)) {
    const excess = power - lethalNeeded;
    if (excess > 0) state.players[defender.controller].hp -= excess;
  }
}

// Combat mutuel façon Hearthstone, avec Initiative (premier frappe) :
// une créature avec Initiative qui tue sa cible avant la riposte ne subit rien.
function resolveCreatureCombat(state, attacker, defender) {
  const atkFirst = hasKeyword(attacker, KEYWORDS.INITIATIVE) && !hasKeyword(defender, KEYWORDS.INITIATIVE);
  const defFirst = hasKeyword(defender, KEYWORDS.INITIATIVE) && !hasKeyword(attacker, KEYWORDS.INITIATIVE);

  if (atkFirst) {
    dealCombatBlow(state, attacker, defender);
    if (!isDead(defender)) dealCombatBlow(state, defender, attacker);
  } else if (defFirst) {
    dealCombatBlow(state, defender, attacker);
    if (!isDead(attacker)) dealCombatBlow(state, attacker, defender);
  } else {
    // Simultané : les deux se frappent.
    dealCombatBlow(state, attacker, defender);
    dealCombatBlow(state, defender, attacker);
  }

  log(state, `${attacker.name} affronte ${defender.name}.`);
  if (isDead(defender)) log(state, `${defender.name} est détruite.`);
  if (isDead(attacker)) log(state, `${attacker.name} est détruite.`);
}

// Attaque directe d'un joueur (visage), avec Lien de vie.
function attackPlayer(state, attacker, targetPlayer) {
  const power = effectivePower(attacker);
  state.players[targetPlayer].hp -= power;
  if (hasKeyword(attacker, KEYWORDS.LIFELINK)) gainHp(state, attacker.controller, power);
}

// Déplace les créatures mortes vers le cimetière, après avoir émis leur on_death.
function cleanupDeaths(state) {
  for (const player of ['player', 'bot']) {
    for (const c of state.players[player].board.filter(isDead)) {
      triggerEvent(state, deps, TRIGGERS.ON_DEATH, { creature: c });
    }
  }
  for (const player of ['player', 'bot']) {
    const p = state.players[player];
    const survivors = [];
    for (const c of p.board) {
      if (isDead(c)) p.graveyard.push(toGraveyardCard(c));
      else survivors.push(c);
    }
    p.board = survivors;
  }
}

function checkGameEnd(state) {
  if (state.status !== 'playing') return;
  if (state.players.bot.hp <= 0) {
    state.players.bot.hp = 0;
    state.status = 'victory';
    log(state, 'Victoire ! L’adversaire est vaincu.');
  } else if (state.players.player.hp <= 0) {
    state.players.player.hp = 0;
    state.status = 'defeat';
    log(state, 'Défaite… vous êtes vaincu.');
  }
}

function checkResourceDefeat(state) {
  if (state.status !== 'playing') return;
  const p = state.players.player;
  if (p.hand.length === 0 && p.extraDraws >= state.rules.extraDrawsMax) {
    state.status = 'defeat';
    log(state, 'Défaite : votre main est vide après toutes les pioches.');
  }
}

function checkTurnLimit(state) {
  if (state.status !== 'playing') return;
  if (state.players.player.turnsTaken > state.rules.maxTurns) {
    state.status = 'defeat';
    log(state, `Défaite : combat interminable (plus de ${state.rules.maxTurns} tours).`);
  }
}

// ---------------------------------------------------------------------------
// Jeu de cartes (partagé joueur / bot)
// ---------------------------------------------------------------------------

// Pose une créature et émet son ETB (on_enter).
function enterCreature(state, card, controller) {
  const creature = makeBoardCreature(card, controller);
  state.players[controller].board.push(creature);
  triggerEvent(state, deps, TRIGGERS.ON_ENTER, { creature });
  cleanupDeaths(state);
  return creature;
}

// Résout un rituel : compteur de Dépense, capacités `cast`, puis on_spell_cast.
function castSorcery(state, controller, card, target) {
  const p = state.players[controller];
  p.manaSpentThisTurn = (p.manaSpentThisTurn ?? 0) + card.cost;
  resolveCast(state, deps, controller, card, target);
  triggerEvent(state, deps, TRIGGERS.ON_SPELL_CAST, { controller });
  p.graveyard.push(toGraveyardCard(card));
  cleanupDeaths(state);
}

// ---------------------------------------------------------------------------
// Actions publiques du joueur
// ---------------------------------------------------------------------------

export function playCard(state, instanceId, target = null) {
  if (state.status !== 'playing' || state.activePlayer !== 'player') return state;
  const s = clone(state);
  const p = s.players.player;
  const idx = p.hand.findIndex((c) => c.instanceId === instanceId);
  if (idx < 0) return state;

  const card = p.hand[idx];
  if (card.cost > p.mana) return state; // injouable

  p.hand.splice(idx, 1);
  p.mana -= card.cost;

  if (card.type === CARD_TYPES.CREATURE) {
    enterCreature(s, card, 'player');
    log(s, `Vous jouez ${card.name}.`);
  } else {
    log(s, `Vous jouez ${card.name}.`);
    castSorcery(s, 'player', card, target);
  }

  checkGameEnd(s);
  return s;
}

export function attack(state, attackerId, target) {
  if (state.status !== 'playing' || state.activePlayer !== 'player') return state;
  const s = clone(state);
  const attacker = s.players.player.board.find((c) => c.instanceId === attackerId);
  if (!attacker || !attacker.readyToAttack || attacker.hasAttacked) return state;
  if (effectivePower(attacker) <= 0) return state;

  triggerEvent(s, deps, TRIGGERS.ON_ATTACK, { creature: attacker });

  if (target.type === 'player') {
    attackPlayer(s, attacker, 'bot');
    log(s, `${attacker.name} attaque l'adversaire pour ${effectivePower(attacker)}.`);
  } else if (target.type === 'creature') {
    const defender = s.players.bot.board.find((c) => c.instanceId === target.instanceId);
    if (!defender) return state;
    if (!canBeAttackedBy(defender, attacker)) return state; // règle de Vol / Portée
    resolveCreatureCombat(s, attacker, defender);
  } else {
    return state;
  }

  attacker.hasAttacked = true;
  cleanupDeaths(s);
  checkGameEnd(s);
  return s;
}

// Fin du tour du joueur : nettoyage, puis tour complet du bot, puis retour au joueur.
export function endTurn(state) {
  if (state.status !== 'playing' || state.activePlayer !== 'player') return state;
  const s = clone(state);

  expireTemporaryBuffs(s, 'player');
  checkGameEnd(s);
  if (s.status !== 'playing') return s;

  runBotTurn(s);
  if (s.status !== 'playing') return s;

  startTurn(s, 'player');
  checkResourceDefeat(s);
  checkTurnLimit(s);
  return s;
}

// Résultat exploitable par la couche run. null tant que le combat est en cours.
export function getCombatResult(state) {
  if (state.status === 'playing') return null;
  return {
    outcome: state.status === 'victory' ? 'win' : 'loss',
    playerHpAfter: Math.max(0, state.players.player.hp),
  };
}

// ---------------------------------------------------------------------------
// IA du bot (minimale)
// ---------------------------------------------------------------------------

function playBotCard(state, card, target = null) {
  const bot = state.players.bot;
  const idx = bot.hand.findIndex((c) => c.instanceId === card.instanceId);
  if (idx < 0) return;
  bot.hand.splice(idx, 1);
  bot.mana -= card.cost;
  if (card.type === CARD_TYPES.CREATURE) {
    enterCreature(state, card, 'bot');
    log(state, `Le bot joue ${card.name}.`);
  } else {
    log(state, `Le bot joue ${card.name}.`);
    castSorcery(state, 'bot', card, target);
  }
}

function runBotTurn(state, rng = Math.random) {
  startTurn(state, 'bot');
  const bot = state.players.bot;
  const hero = state.players.player;

  // 1) Jouer les créatures abordables, les plus chères d'abord.
  let playedSomething = true;
  while (playedSomething) {
    playedSomething = false;
    const affordable = bot.hand
      .filter((c) => c.type === CARD_TYPES.CREATURE && c.cost <= bot.mana)
      .sort((a, b) => b.cost - a.cost);
    if (affordable.length > 0) {
      playBotCard(state, affordable[0]);
      playedSomething = true;
    }
    if (state.status !== 'playing') return;
  }

  // 2) Rituels de dégâts : viser la créature adverse tuable, sinon le visage.
  const burnSpells = bot.hand.filter((c) => c.type === CARD_TYPES.SORCERY && c.effect === 'deal_damage');
  for (const spell of burnSpells) {
    if (spell.cost > bot.mana) continue;
    const killable = hero.board
      .filter((c) => remainingToughness(c) <= spell.value)
      .sort((a, b) => effectivePower(b) - effectivePower(a));
    if (killable.length > 0) {
      playBotCard(state, spell, { type: 'creature', instanceId: killable[0].instanceId });
    } else {
      playBotCard(state, spell, { type: 'player', player: 'player' });
      checkGameEnd(state);
      if (state.status !== 'playing') return;
    }
  }

  // 3) Buff : renforcer sa plus grosse créature prête à attaquer.
  const buffSpells = bot.hand.filter((c) => c.type === CARD_TYPES.SORCERY && c.effect === 'buff');
  for (const spell of buffSpells) {
    if (spell.cost > bot.mana) continue;
    const attackers = bot.board
      .filter((c) => c.readyToAttack && !c.hasAttacked)
      .sort((a, b) => effectivePower(b) - effectivePower(a));
    if (attackers.length > 0) {
      playBotCard(state, spell, { type: 'creature', instanceId: attackers[0].instanceId });
    }
  }

  // 4) Attaquer avec toutes les créatures prêtes.
  const readyAttackers = bot.board.filter((c) => c.readyToAttack && !c.hasAttacked && effectivePower(c) > 0);
  for (const attacker of readyAttackers) {
    if (!bot.board.includes(attacker)) continue; // a pu mourir entre-temps
    triggerEvent(state, deps, TRIGGERS.ON_ATTACK, { creature: attacker });
    if (hero.board.length > 0) {
      const reachable = hero.board.filter((d) => canBeAttackedBy(d, attacker));
      if (reachable.length === 0) continue;
      const defender = pickRandom(reachable, rng);
      resolveCreatureCombat(state, attacker, defender);
    } else {
      attackPlayer(state, attacker, 'player');
      log(state, `${attacker.name} attaque le joueur pour ${effectivePower(attacker)}.`);
    }
    attacker.hasAttacked = true;
    cleanupDeaths(state);
    checkGameEnd(state);
    if (state.status !== 'playing') return;
  }

  expireTemporaryBuffs(state, 'bot');
  checkGameEnd(state);
}

// Export pour tests unitaires ciblés (non utilisés par l'UI).
export const _internals = {
  startTurn,
  resolveCreatureCombat,
  cleanupDeaths,
  damageCreature,
  createToken,
  destroyCreature,
  addBuff,
  grantKeyword,
  runBotTurn,
  checkGameEnd,
  checkResourceDefeat,
  gainHp,
  deps,
};
