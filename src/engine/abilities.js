// Moteur de capacités & d'effets (Jalon 3). Pur, sans React.
// Ne connaît pas les primitives de mutation du combat : elles sont injectées via
// `deps` par game.js (damageCreature, gainHp, createToken…), ce qui évite tout
// import circulaire. Ce module ne fait que router triggers → effets.

import { TRIGGERS, EFFECT_TYPES } from './constants.js';
import { effectivePower } from './selectors.js';

const opponentOf = (p) => (p === 'player' ? 'bot' : 'player');

function findCreature(state, instanceId) {
  for (const p of ['player', 'bot']) {
    const c = state.players[p].board.find((x) => x.instanceId === instanceId);
    if (c) return c;
  }
  return null;
}

// Résout la liste des cibles d'un effet. Les cibles « chosen_* » viennent du
// joueur (ou du bot) ; les autres sont automatiques (data-driven).
function resolveTargets(state, source, effect, providedTarget) {
  const controller = source.controller;
  const opp = opponentOf(controller);
  const asCreatures = (board) => board.map((c) => ({ kind: 'creature', creature: c }));

  switch (effect.target) {
    case 'self':
      return source.creature ? [{ kind: 'creature', creature: source.creature }] : [];
    case 'enemy_face':
      return [{ kind: 'player', player: opp }];
    case 'controller_face':
      return [{ kind: 'player', player: controller }];
    case 'all_allies':
      return asCreatures(state.players[controller].board);
    case 'all_enemies':
      return asCreatures(state.players[opp].board);
    case 'best_enemy_creature': {
      const best = [...state.players[opp].board].sort((a, b) => effectivePower(b) - effectivePower(a))[0];
      return best ? [{ kind: 'creature', creature: best }] : [];
    }
    case 'chosen_creature':
    case 'chosen_any': {
      if (!providedTarget) return [];
      if (providedTarget.type === 'player') return [{ kind: 'player', player: providedTarget.player }];
      const c = findCreature(state, providedTarget.instanceId);
      return c ? [{ kind: 'creature', creature: c }] : [];
    }
    default:
      return source.creature ? [{ kind: 'creature', creature: source.creature }] : [];
  }
}

// Applique un effet du vocabulaire fermé.
export function applyEffect(state, deps, source, effect, providedTarget) {
  const controller = source.controller;
  const targets = resolveTargets(state, source, effect, providedTarget);

  switch (effect.type) {
    case EFFECT_TYPES.DEAL_DAMAGE:
      for (const t of targets) {
        if (t.kind === 'player') state.players[t.player].hp -= effect.amount;
        else deps.damageCreature(state, t.creature, effect.amount, !!effect.deathtouch);
      }
      break;
    case EFFECT_TYPES.BUFF:
      for (const t of targets) {
        if (t.kind === 'creature') {
          deps.addBuff(t.creature, effect.power ?? 0, effect.toughness ?? 0, effect.duration === 'permanent');
        }
      }
      break;
    case EFFECT_TYPES.GAIN_LIFE:
      deps.gainHp(state, controller, effect.amount);
      break;
    case EFFECT_TYPES.DRAW:
      deps.drawCards(state, controller, effect.count ?? 1);
      break;
    case EFFECT_TYPES.CREATE_TOKEN:
      deps.createToken(state, controller, effect.token ?? effect, effect.count ?? 1);
      break;
    case EFFECT_TYPES.DESTROY:
      for (const t of targets) if (t.kind === 'creature') deps.destroyCreature(state, t.creature);
      break;
    case EFFECT_TYPES.GRANT_KEYWORD:
      for (const t of targets) {
        if (t.kind === 'creature') deps.grantKeyword(t.creature, effect.keyword, effect.duration === 'permanent');
      }
      break;
    default:
      break;
  }
}

function conditionMet(state, source, ability) {
  const c = ability.condition;
  if (!c) return true;
  const p = state.players[source.controller];
  if (c.kind === 'threshold') return p.graveyard.length >= c.min; // Seuil
  if (c.kind === 'expend') return (p.manaSpentThisTurn ?? 0) >= c.min; // Dépense
  return true;
}

// Émet un déclencheur : résout les capacités correspondantes des créatures
// concernées. payload : { controller?, creature? } selon le trigger.
export function triggerEvent(state, deps, trigger, payload = {}) {
  let creatures = [];
  if (
    trigger === TRIGGERS.ON_ENTER ||
    trigger === TRIGGERS.ON_ATTACK ||
    trigger === TRIGGERS.ON_DEATH ||
    trigger === TRIGGERS.ON_TARGETED_BY_OWN
  ) {
    creatures = payload.creature ? [payload.creature] : [];
  } else if (trigger === TRIGGERS.ON_SPELL_CAST || trigger === TRIGGERS.ON_MANA_TIER) {
    creatures = state.players[payload.controller].board.slice();
  }

  for (const creature of creatures) {
    const abilities = creature.abilities ?? [];
    for (let i = 0; i < abilities.length; i++) {
      const ability = abilities[i];
      if (ability.trigger !== trigger) continue;
      const source = { controller: creature.controller, creature };
      if (!conditionMet(state, source, ability)) continue;
      if (ability.limit_per_turn) {
        creature.abilityUses ??= {};
        if ((creature.abilityUses[i] ?? 0) >= ability.limit_per_turn) continue;
        creature.abilityUses[i] = (creature.abilityUses[i] ?? 0) + 1;
      }
      applyEffect(state, deps, source, ability.effect, null);
      deps.log(state, `Capacité de ${creature.name} déclenchée.`);
    }
  }
}

// Résout un rituel : ses capacités `cast`. Émet Vaillance si une créature
// alliée est ciblée.
export function resolveCast(state, deps, controller, card, providedTarget) {
  const source = { controller, creature: null };
  for (const ability of card.abilities ?? []) {
    if (ability.trigger !== TRIGGERS.CAST) continue;
    if (!conditionMet(state, source, ability)) continue;
    applyEffect(state, deps, source, ability.effect, providedTarget);
  }
  if (providedTarget?.type === 'creature') {
    const ally = state.players[controller].board.find((x) => x.instanceId === providedTarget.instanceId);
    if (ally) triggerEvent(state, deps, TRIGGERS.ON_TARGETED_BY_OWN, { creature: ally });
  }
}
