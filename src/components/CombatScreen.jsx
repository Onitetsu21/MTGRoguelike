import { useMemo, useState } from 'react';
import {
  isCardPlayable,
  canAttack,
  getAttackTargets,
  getSpellTargets,
  getCombatResult,
  CARD_TYPES,
} from '../engine/index.js';
import Card from './Card.jsx';
import Creature from './Creature.jsx';
import PlayerBar from './PlayerBar.jsx';
import GameLog from './GameLog.jsx';

// Écran de combat. Reçoit l'état de combat et les actions depuis useRun ;
// appelle onFinish quand le joueur clique « Continuer » après la fin du combat.
export default function CombatScreen({ state, onPlayCard, onAttack, onEndTurn, onFinish, run }) {
  const [selectedAttacker, setSelectedAttacker] = useState(null);
  const [pendingSpell, setPendingSpell] = useState(null);

  const clearSelection = () => {
    setSelectedAttacker(null);
    setPendingSpell(null);
  };

  const result = getCombatResult(state);
  const playing = state.status === 'playing';

  const targeting = useMemo(() => {
    if (pendingSpell) {
      const t = getSpellTargets(state, pendingSpell.instanceId);
      return { creatures: new Set(t.creatures ?? []), botFace: t.face === 'bot' };
    }
    if (selectedAttacker) {
      const t = getAttackTargets(state, selectedAttacker);
      return { creatures: new Set(t.creatures ?? []), botFace: !!t.face };
    }
    return { creatures: new Set(), botFace: false };
  }, [state, pendingSpell, selectedAttacker]);

  const handleHandCard = (card) => {
    if (!playing) return;
    if (card.type === CARD_TYPES.CREATURE) {
      onPlayCard(card.instanceId);
      clearSelection();
      return;
    }
    const t = getSpellTargets(state, card.instanceId);
    const hasTargets = (t.creatures?.length ?? 0) > 0 || t.face;
    if (!t.needsTarget) {
      onPlayCard(card.instanceId);
      clearSelection();
    } else if (hasTargets) {
      setSelectedAttacker(null);
      setPendingSpell({ instanceId: card.instanceId });
    }
  };

  const handleCreatureClick = (creature, side) => {
    if (!playing) return;
    if (pendingSpell) {
      if (targeting.creatures.has(creature.instanceId)) {
        onPlayCard(pendingSpell.instanceId, { type: 'creature', instanceId: creature.instanceId });
        clearSelection();
      }
      return;
    }
    if (selectedAttacker && side === 'bot') {
      if (targeting.creatures.has(creature.instanceId)) {
        onAttack(selectedAttacker, { type: 'creature', instanceId: creature.instanceId });
        clearSelection();
      }
      return;
    }
    if (side === 'player' && canAttack(state, 'player', creature.instanceId)) {
      setSelectedAttacker((cur) => (cur === creature.instanceId ? null : creature.instanceId));
    }
  };

  const handleFaceClick = (side) => {
    if (!playing) return;
    if (pendingSpell && side === 'bot' && targeting.botFace) {
      onPlayCard(pendingSpell.instanceId, { type: 'player', player: 'bot' });
      clearSelection();
      return;
    }
    if (selectedAttacker && side === 'bot' && targeting.botFace) {
      onAttack(selectedAttacker, { type: 'player' });
      clearSelection();
    }
  };

  const handleEndTurn = () => {
    clearSelection();
    onEndTurn();
  };

  const { player, bot } = state.players;

  const modeHint = pendingSpell
    ? 'Choisissez une cible pour le rituel (Échap pour annuler).'
    : selectedAttacker
    ? 'Choisissez la cible : une créature adverse ou l’adversaire.'
    : 'Jouez des cartes, puis sélectionnez une créature pour attaquer.';

  return (
    <div className="game" onKeyDown={(e) => e.key === 'Escape' && clearSelection()} tabIndex={-1}>
      <div className="board-column">
        {run && (
          <div className="combat-banner">
            🪙 {run.gold} · 🗺 Niv. {run.level + 1} · Deck {run.deck.length}
          </div>
        )}

        <PlayerBar
          name={state.enemyName ?? 'Adversaire'}
          player={bot}
          side="bot"
          faceTargetable={targeting.botFace}
          onFaceClick={handleFaceClick}
        />

        <div className="battlefield battlefield--bot">
          {bot.board.length === 0 && <span className="empty-hint">Aucune créature adverse</span>}
          {bot.board.map((c) => (
            <Creature
              key={c.instanceId}
              creature={c}
              side="bot"
              selectable={false}
              selected={false}
              targetable={targeting.creatures.has(c.instanceId)}
              onClick={handleCreatureClick}
            />
          ))}
        </div>

        <div className="battlefield-divider">
          <span className="mode-hint">{modeHint}</span>
        </div>

        <div className="battlefield battlefield--player">
          {player.board.length === 0 && <span className="empty-hint">Aucune créature</span>}
          {player.board.map((c) => (
            <Creature
              key={c.instanceId}
              creature={c}
              side="player"
              selectable={canAttack(state, 'player', c.instanceId)}
              selected={selectedAttacker === c.instanceId}
              targetable={pendingSpell ? targeting.creatures.has(c.instanceId) : false}
              onClick={handleCreatureClick}
            />
          ))}
        </div>

        <PlayerBar name="Vous" player={player} side="player" faceTargetable={false} onFaceClick={handleFaceClick} />

        <div className="hand-area">
          <div className="hand">
            {player.hand.map((card) => (
              <Card
                key={card.instanceId}
                card={card}
                playable={playing && isCardPlayable(state, 'player', card.instanceId)}
                selected={pendingSpell?.instanceId === card.instanceId}
                onClick={handleHandCard}
              />
            ))}
            {player.hand.length === 0 && <span className="empty-hint">Main vide</span>}
          </div>
          <button type="button" className="end-turn" onClick={handleEndTurn} disabled={!playing}>
            Fin du tour ▶
          </button>
        </div>
      </div>

      <aside className="sidebar">
        <GameLog log={state.log} />
      </aside>

      {result && (
        <div className="overlay">
          <div className="overlay-box">
            <h1>{result.outcome === 'win' ? '🏆 Combat gagné' : '💀 Combat perdu'}</h1>
            <p>
              {result.outcome === 'win'
                ? 'Vous poursuivez votre chemin.'
                : 'Vous perdez 20 PV max… mais pouvez retenter.'}
            </p>
            <button type="button" onClick={onFinish}>
              Continuer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
