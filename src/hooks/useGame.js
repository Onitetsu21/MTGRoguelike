import { useCallback, useState } from 'react';
import { createGame, playCard, attack, endTurn } from '../engine/index.js';
import { cardDb, decks } from '../data/loadData.js';

// Fait le pont entre le moteur (pur) et React.
// Aucune règle de jeu ici : uniquement de l'orchestration d'état.
export function useGame() {
  const [state, setState] = useState(() => createGame(cardDb, decks.player, decks.bot));

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
    setState(createGame(cardDb, decks.player, decks.bot));
  }, []);

  return { state, doPlayCard, doAttack, doEndTurn, reset };
}
