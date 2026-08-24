import { useCallback, useState } from 'react';
import { createGame, playCard, attack, endTurn } from '../engine/index.js';
import { cardDb, content } from '../data/loadData.js';

// Pont React <-> moteur de combat.
//
// NOTE (Jalon 2, étape MVP-A) : tant que le draft et la carte de run ne sont pas
// branchés (étapes MVP-B/C), l'app démarre sur un combat de démonstration
// construit depuis les données (deck fixe vs première rencontre) pour valider le
// nouveau combat paramétré et les nouveaux mots-clés. Le hook `useRun` viendra
// remplacer ceci par la vraie boucle de run.

const DEMO_DECK = [
  'thornback_pup', 'emberclaw_cub', 'lightning_jolt', 'quick_strike',
  'sparrow_scout', 'dawn_cleric', 'skyguard_falcon', 'venom_stalker',
  'bramble_brute', 'ironhide_ox', 'magma_brute', 'dread_reaper',
];

function demoSetup() {
  const enc = content.encounters.encounters.midrange_green;
  const b = content.balance;
  return {
    playerDeck: DEMO_DECK,
    enemyDeck: enc.deck,
    playerHp: b.run.starting_max_hp,
    playerMaxHp: b.run.starting_max_hp,
    enemyHp: enc.hp,
    enemyMaxHp: enc.hp,
    playerManaCap: b.run.starting_mana_cap,
    enemyManaCap: b.combat.enemy_default_mana_cap,
    enemyName: enc.name,
    params: {
      startingHandSize: b.combat.starting_hand_size,
      extraDrawsMax: b.combat.extra_draws_max,
      extraDrawInterval: b.combat.extra_draw_interval,
    },
  };
}

export function useGame() {
  const [state, setState] = useState(() => createGame(cardDb, demoSetup()));

  const doPlayCard = useCallback((instanceId, target) => {
    setState((s) => playCard(s, instanceId, target));
  }, []);

  const doAttack = useCallback((attackerId, target) => {
    setState((s) => attack(s, attackerId, target));
  }, []);

  const doEndTurn = useCallback(() => {
    setState((s) => endTurn(s));
  }, []);

  const reset = useCallback(() => {
    setState(createGame(cardDb, demoSetup()));
  }, []);

  return { state, doPlayCard, doAttack, doEndTurn, reset };
}
