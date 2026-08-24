// Fonctions dérivées pures. Aucune mutation d'état.
// Utilisées à la fois par le moteur (game.js) et par l'affichage (composants React).

import { KEYWORDS, CARD_TYPES } from './constants.js';

export function hasKeyword(creature, keyword) {
  if (Array.isArray(creature.keywords) && creature.keywords.includes(keyword)) return true;
  // Mots-clés octroyés temporairement/en permanence (grant_keyword).
  return Array.isArray(creature.grantedKeywords) && creature.grantedKeywords.some((g) => g.keyword === keyword);
}

// Somme des buffs temporaires appliqués à une créature.
function sumBuffs(creature, field) {
  if (!creature.tempBuffs) return 0;
  return creature.tempBuffs.reduce((acc, b) => acc + (b[field] ?? 0), 0);
}

// Force effective (base + buffs temporaires), jamais négative.
export function effectivePower(creature) {
  return Math.max(0, creature.basePower + sumBuffs(creature, 'power'));
}

// Endurance effective (base + buffs temporaires), minimum 1.
export function effectiveToughness(creature) {
  return Math.max(1, creature.baseToughness + sumBuffs(creature, 'toughness'));
}

// Points de vie restants d'une créature (endurance - dégâts marqués).
export function remainingToughness(creature) {
  return effectiveToughness(creature) - creature.markedDamage;
}

export function isDead(creature) {
  if (hasKeyword(creature, KEYWORDS.INDESTRUCTIBLE)) return false; // survit dégâts & « détruire »
  return creature.markedDamage >= effectiveToughness(creature);
}

// Une carte de la main est-elle jouable avec le mana disponible ?
export function isCardPlayable(state, player, instanceId) {
  if (state.status !== 'playing' || state.activePlayer !== player) return false;
  const p = state.players[player];
  const card = p.hand.find((c) => c.instanceId === instanceId);
  if (!card) return false;
  return card.cost <= p.mana;
}

// Une créature peut-elle attaquer ce tour-ci ?
export function canAttack(state, player, instanceId) {
  if (state.status !== 'playing' || state.activePlayer !== player) return false;
  const c = state.players[player].board.find((x) => x.instanceId === instanceId);
  if (!c) return false;
  return c.readyToAttack && !c.hasAttacked && effectivePower(c) > 0;
}

// Règle de Vol : une créature avec Vol ne peut être attaquée que par une créature
// avec Vol ou Portée (Portée = contre-jeu au Vol).
export function canBeAttackedBy(defender, attacker) {
  if (
    hasKeyword(defender, KEYWORDS.FLYING) &&
    !hasKeyword(attacker, KEYWORDS.FLYING) &&
    !hasKeyword(attacker, KEYWORDS.REACH)
  ) {
    return false;
  }
  return true;
}

// Cibles d'attaque valides pour une créature du joueur actif.
// Le joueur peut toujours viser l'adversaire directement, même si des créatures restent.
// (Le bot, lui, suit une règle plus stricte gérée dans game.js.)
export function getAttackTargets(state, attackerId) {
  const attacker = state.players.player.board.find((c) => c.instanceId === attackerId);
  if (!attacker) return { face: false, creatures: [] };
  const enemyCreatures = state.players.bot.board
    .filter((d) => canBeAttackedBy(d, attacker))
    .map((d) => d.instanceId);
  return { face: true, creatures: enemyCreatures };
}

// Cibles valides pour un rituel (pour l'UI). Dérivé du type de cible de la
// capacité `cast` : « chosen_any » = créature (des 2 camps) ou adversaire ;
// « chosen_creature » = créature alliée. Les autres cibles sont automatiques.
export function getSpellTargets(state, instanceId) {
  const card = state.players.player.hand.find((c) => c.instanceId === instanceId);
  if (!card || card.type !== CARD_TYPES.SORCERY) return { needsTarget: false };

  const castEffect = card.abilities?.find((a) => a.trigger === 'cast')?.effect;
  const targetKind = castEffect?.target;

  if (targetKind === 'chosen_any') {
    return {
      needsTarget: true,
      face: 'bot',
      creatures: [
        ...state.players.player.board.map((c) => c.instanceId),
        ...state.players.bot.board.map((c) => c.instanceId),
      ],
    };
  }
  if (targetKind === 'chosen_creature') {
    return {
      needsTarget: true,
      face: null,
      creatures: state.players.player.board.map((c) => c.instanceId),
    };
  }
  return { needsTarget: false };
}
