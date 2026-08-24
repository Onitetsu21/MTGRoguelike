// Cœur du moteur de combat.
// Aucun import React : ce module est testable indépendamment de l'interface.
//
// Depuis le Jalon 2, le combat est paramétré par le run (deck, PV courants,
// rencontre ennemie, plafond de mana, paramètres de pioche) au lieu de valeurs
// fixes. Voir src/engine/run.js pour l'état de run qui l'enveloppe.
//
// Convention : les fonctions publiques (createGame, playCard, attack, endTurn)
// ne modifient jamais l'état reçu ; elles renvoient un nouvel état (clone).
// Les fonctions internes mutent un état de travail déjà cloné.

import {
  STARTING_HP,
  MANA_CAP,
  STARTING_HAND_SIZE,
  MAX_EXTRA_DRAWS,
  EXTRA_DRAW_INTERVAL,
  KEYWORDS,
  CARD_TYPES,
} from './constants.js';
import { buildDeck } from './deck.js';
import { pickRandom } from './rng.js';
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

// ---------------------------------------------------------------------------
// Création de partie
// ---------------------------------------------------------------------------

// setup = {
//   playerDeck: [cardId...], enemyDeck: [cardId...],
//   playerHp, playerMaxHp, enemyHp, enemyMaxHp,
//   playerManaCap, enemyManaCap,
//   enemyName,
//   params: { startingHandSize, extraDrawsMax, extraDrawInterval }
// }
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
  p.maxMana = Math.min(p.turnsTaken, p.manaCap);
  p.mana = p.maxMana;

  // Pioche supplémentaire tous les N tours (tours 3, 5, ...), plafonnée.
  if (
    p.turnsTaken >= 3 &&
    (p.turnsTaken - 1) % state.rules.extraDrawInterval === 0 &&
    p.extraDraws < state.rules.extraDrawsMax
  ) {
    const drawn = drawCards(state, player, 1);
    if (drawn > 0) {
      p.extraDraws += 1;
      log(
        state,
        `${label(player)} pioche une carte (pioche ${p.extraDraws}/${state.rules.extraDrawsMax}).`
      );
    }
  }

  // Les créatures se réveillent et peuvent réattaquer.
  for (const c of p.board) {
    c.readyToAttack = true;
    c.hasAttacked = false;
  }

  log(state, `Tour ${p.turnsTaken} de ${label(player)} — ${p.mana} mana.`);
}

// Fin du tour d'un joueur : les buffs temporaires de ses créatures expirent.
function expireTemporaryBuffs(state, player) {
  for (const c of state.players[player].board) {
    if (c.tempBuffs && c.tempBuffs.length > 0) c.tempBuffs = [];
  }
  cleanupDeaths(state); // une baisse d'endurance peut être létale
}

// ---------------------------------------------------------------------------
// Combat & résolution
// ---------------------------------------------------------------------------

function damageCreature(state, creature, amount, deathtouch) {
  if (amount <= 0) return;
  creature.markedDamage += amount;
  if (deathtouch) {
    // Toucher mortel : tout dégât ≥ 1 est létal.
    creature.markedDamage = Math.max(creature.markedDamage, effectiveToughness(creature));
  }
}

// Combat mutuel entre deux créatures (modèle façon Hearthstone : les deux
// se frappent). Gère Piétinement, Toucher mortel et Lien de vie.
function resolveCreatureCombat(state, attacker, defender) {
  const defenderOwner = state.players[defender.controller];

  const atkPower = effectivePower(attacker);
  const defPower = effectivePower(defender);
  const atkDeathtouch = hasKeyword(attacker, KEYWORDS.DEATHTOUCH);
  const defDeathtouch = hasKeyword(defender, KEYWORDS.DEATHTOUCH);

  // Dégâts nécessaires pour tuer la cible AVANT que l'attaquant ne frappe.
  const healthBefore = remainingToughness(defender);
  const lethalNeeded = atkDeathtouch ? Math.min(1, healthBefore) : healthBefore;

  // L'attaquant frappe la cible.
  damageCreature(state, defender, atkPower, atkDeathtouch);
  if (hasKeyword(attacker, KEYWORDS.LIFELINK)) gainHp(state, attacker.controller, atkPower);

  // Piétinement : l'excédent au-delà du létal passe au joueur adverse.
  if (hasKeyword(attacker, KEYWORDS.TRAMPLE) && isDead(defender)) {
    const excess = atkPower - lethalNeeded;
    if (excess > 0) defenderOwner.hp -= excess;
  }

  // La cible riposte (pas de piétinement en défense).
  damageCreature(state, attacker, defPower, defDeathtouch);
  if (hasKeyword(defender, KEYWORDS.LIFELINK)) gainHp(state, defender.controller, defPower);

  log(
    state,
    `${attacker.name} (${atkPower}/${effectiveToughness(attacker)}) affronte ${defender.name} (${defPower}/${effectiveToughness(defender)}).`
  );

  if (isDead(defender)) log(state, `${defender.name} est détruite.`);
  if (isDead(attacker)) log(state, `${attacker.name} est détruite.`);
}

// Attaque directe d'un joueur (visage), avec Lien de vie.
function attackPlayer(state, attacker, targetPlayer) {
  const power = effectivePower(attacker);
  state.players[targetPlayer].hp -= power;
  if (hasKeyword(attacker, KEYWORDS.LIFELINK)) gainHp(state, attacker.controller, power);
}

// Déplace toutes les créatures mortes vers leur cimetière respectif.
function cleanupDeaths(state) {
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

// Défaite par épuisement : plus de cartes en main et toutes les pioches consommées.
function checkResourceDefeat(state) {
  if (state.status !== 'playing') return;
  const p = state.players.player;
  if (p.hand.length === 0 && p.extraDraws >= state.rules.extraDrawsMax) {
    state.status = 'defeat';
    log(state, 'Défaite : votre main est vide après toutes les pioches.');
  }
}

// Garde-fou anti-blocage : un combat qui n'aboutit jamais (ex. verrou volantes
// vs créatures au sol, main figée) se solde par une défaite au-delà du plafond.
function checkTurnLimit(state) {
  if (state.status !== 'playing') return;
  if (state.players.player.turnsTaken > state.rules.maxTurns) {
    state.status = 'defeat';
    log(state, `Défaite : combat interminable (plus de ${state.rules.maxTurns} tours).`);
  }
}

// ---------------------------------------------------------------------------
// Rituels
// ---------------------------------------------------------------------------

function findAnyCreature(state, instanceId) {
  for (const player of ['player', 'bot']) {
    const c = state.players[player].board.find((x) => x.instanceId === instanceId);
    if (c) return c;
  }
  return null;
}

function resolveSorcery(state, controller, card, target) {
  if (card.effect === 'deal_damage') {
    if (target?.type === 'player') {
      state.players[target.player].hp -= card.value;
      log(state, `${card.name} inflige ${card.value} à ${label(target.player).toLowerCase()}.`);
    } else if (target?.type === 'creature') {
      const creature = findAnyCreature(state, target.instanceId);
      if (creature) {
        damageCreature(state, creature, card.value, false);
        log(state, `${card.name} inflige ${card.value} à ${creature.name}.`);
      }
    }
  } else if (card.effect === 'buff') {
    if (target?.type === 'creature') {
      const creature = state.players[controller].board.find(
        (x) => x.instanceId === target.instanceId
      );
      if (creature) {
        creature.tempBuffs.push({ power: card.buff.power, toughness: card.buff.toughness });
        log(
          state,
          `${card.name} : ${creature.name} gagne +${card.buff.power}/+${card.buff.toughness} ce tour.`
        );
      }
    }
  }
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
    p.board.push(makeBoardCreature(card, 'player'));
    log(s, `Vous jouez ${card.name}.`);
  } else {
    resolveSorcery(s, 'player', card, target);
    p.graveyard.push(toGraveyardCard(card));
  }

  cleanupDeaths(s);
  checkGameEnd(s);
  return s;
}

export function attack(state, attackerId, target) {
  if (state.status !== 'playing' || state.activePlayer !== 'player') return state;
  const s = clone(state);
  const attacker = s.players.player.board.find((c) => c.instanceId === attackerId);
  if (!attacker || !attacker.readyToAttack || attacker.hasAttacked) return state;
  if (effectivePower(attacker) <= 0) return state;

  if (target.type === 'player') {
    // Le joueur peut viser l'adversaire directement même s'il reste des créatures.
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
    bot.board.push(makeBoardCreature(card, 'bot'));
    log(state, `Le bot joue ${card.name}.`);
  } else {
    resolveSorcery(state, 'bot', card, target);
    bot.graveyard.push(toGraveyardCard(card));
  }
  cleanupDeaths(state);
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
  }

  // 2) Rituels de dégâts : viser la créature adverse la plus menaçante qu'on peut
  //    tuer, sinon le visage du joueur.
  const burnSpells = bot.hand.filter(
    (c) => c.type === CARD_TYPES.SORCERY && c.effect === 'deal_damage'
  );
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
  //    Règle : tant que le joueur a une créature, le bot doit viser une créature
  //    (au hasard parmi celles qu'il peut atteindre). Sinon, il frappe le joueur.
  const readyAttackers = bot.board.filter(
    (c) => c.readyToAttack && !c.hasAttacked && effectivePower(c) > 0
  );
  for (const attacker of readyAttackers) {
    if (hero.board.length > 0) {
      const reachable = hero.board.filter((d) => canBeAttackedBy(d, attacker));
      if (reachable.length === 0) continue; // ne peut atteindre aucune créature, ni le joueur
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
  resolveSorcery,
  runBotTurn,
  checkGameEnd,
  checkResourceDefeat,
  gainHp,
};
