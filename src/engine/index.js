// API publique du moteur. Les composants importent uniquement depuis ici.
export { createGame, playCard, attack, endTurn, makeBoardCreature } from './game.js';
export {
  effectivePower,
  effectiveToughness,
  remainingToughness,
  isDead,
  hasKeyword,
  isCardPlayable,
  canAttack,
  canBeAttackedBy,
  getAttackTargets,
  getSpellTargets,
} from './selectors.js';
export { buildCardDb } from './deck.js';
export * from './constants.js';
