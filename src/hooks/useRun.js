import { useState, useEffect, useCallback } from 'react';
import { content, cardDb } from '../data/loadData.js';
import {
  createGame,
  playCard,
  attack,
  endTurn,
  getCombatResult,
  createDraft,
  draftPick,
  createRun,
  enterNode,
  buildCombatSetup,
  resolveCombat,
  pickConsolation,
  buyShopCard,
  buyManaCap,
  buyHeal,
  buyBooster,
  pickBoosterCard,
  leaveShop,
  applyEvent,
} from '../engine/index.js';

// Orchestration React de la boucle de run : titre → draft → run (carte,
// combats, boutique, événements, défaite/consolation, fin). La logique de jeu
// vit dans le moteur (run.js / game.js) ; ce hook ne fait que router l'état.
export function useRun() {
  const [phase, setPhase] = useState('title'); // 'title' | 'draft' | 'run'
  const [draft, setDraft] = useState(null);
  const [run, setRun] = useState(null);
  const [combat, setCombat] = useState(null); // état de combat quand run.status === 'combat'

  // Crée le combat dès que le run entre en statut combat (nouveau nœud ou retry).
  useEffect(() => {
    if (phase === 'run' && run?.status === 'combat' && combat === null) {
      setCombat(createGame(cardDb, buildCombatSetup(run, content)));
    }
  }, [phase, run, combat]);

  // Fin du draft → démarrage du run.
  useEffect(() => {
    if (phase === 'draft' && draft?.done) {
      setRun(createRun(content, draft.picked));
      setDraft(null);
      setPhase('run');
    }
  }, [phase, draft]);

  // --- Titre / draft ---------------------------------------------------------
  const startDraft = useCallback(() => {
    setDraft(createDraft(content));
    setPhase('draft');
  }, []);
  const pickDraft = useCallback((cardId) => setDraft((d) => draftPick(d, cardId)), []);

  // --- Combat ----------------------------------------------------------------
  const combatPlay = useCallback((id, target) => setCombat((c) => playCard(c, id, target)), []);
  const combatAttack = useCallback((id, target) => setCombat((c) => attack(c, id, target)), []);
  const combatEndTurn = useCallback(() => setCombat((c) => endTurn(c)), []);
  const finishCombat = useCallback(() => {
    const result = getCombatResult(combat);
    if (!result) return;
    setRun((r) => resolveCombat(r, content, result));
    setCombat(null);
  }, [combat]);

  // --- Carte de run / boutique / événement / consolation ---------------------
  const goToNode = useCallback((nodeId) => setRun((r) => enterNode(r, content, nodeId)), []);
  const chooseConsolation = useCallback((cardId) => setRun((r) => pickConsolation(r, content, cardId)), []);
  const shopBuyCard = useCallback((cardId) => setRun((r) => buyShopCard(r, content, cardId)), []);
  const shopBuyManaCap = useCallback(() => setRun((r) => buyManaCap(r, content)), []);
  const shopBuyHeal = useCallback(() => setRun((r) => buyHeal(r, content)), []);
  const shopBuyBooster = useCallback(() => setRun((r) => buyBooster(r, content)), []);
  const shopPickBooster = useCallback((cardId) => setRun((r) => pickBoosterCard(r, cardId)), []);
  const shopLeave = useCallback(() => setRun((r) => leaveShop(r)), []);
  const resolveEvent = useCallback(() => setRun((r) => applyEvent(r, content)), []);

  const restart = useCallback(() => {
    setCombat(null);
    setRun(null);
    setDraft(null);
    setPhase('title');
  }, []);

  return {
    content,
    phase,
    draft,
    run,
    combat,
    // titre/draft
    startDraft,
    pickDraft,
    // combat
    combatPlay,
    combatAttack,
    combatEndTurn,
    finishCombat,
    // run
    goToNode,
    chooseConsolation,
    shopBuyCard,
    shopBuyManaCap,
    shopBuyHeal,
    shopBuyBooster,
    shopPickBooster,
    shopLeave,
    resolveEvent,
    restart,
  };
}
