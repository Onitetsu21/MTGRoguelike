import { useMemo, useState } from 'react';
import { useGame } from './hooks/useGame.js';
import {
  isCardPlayable,
  canAttack,
  getAttackTargets,
  getSpellTargets,
  CARD_TYPES,
} from './engine/index.js';
import Card from './components/Card.jsx';
import Creature from './components/Creature.jsx';
import PlayerBar from './components/PlayerBar.jsx';
import GameLog from './components/GameLog.jsx';

export default function App() {
  const { state, doPlayCard, doAttack, doEndTurn, reset } = useGame();

  // Sélection courante : soit un attaquant, soit un rituel en attente de cible.
  const [selectedAttacker, setSelectedAttacker] = useState(null);
  const [pendingSpell, setPendingSpell] = useState(null); // { instanceId }

  const clearSelection = () => {
    setSelectedAttacker(null);
    setPendingSpell(null);
  };

  const playing = state.status === 'playing';

  // Ensemble des cibles valides selon le mode courant.
  const targeting = useMemo(() => {
    if (pendingSpell) {
      const t = getSpellTargets(state, pendingSpell.instanceId);
      return {
        creatures: new Set(t.creatures ?? []),
        botFace: t.face === 'bot',
      };
    }
    if (selectedAttacker) {
      const t = getAttackTargets(state, selectedAttacker);
      return { creatures: new Set(t.creatures ?? []), botFace: !!t.face };
    }
    return { creatures: new Set(), botFace: false };
  }, [state, pendingSpell, selectedAttacker]);

  // --- Gestion des clics -----------------------------------------------------

  const handleHandCard = (card) => {
    if (!playing) return;
    if (card.type === CARD_TYPES.CREATURE) {
      doPlayCard(card.instanceId);
      clearSelection();
      return;
    }
    // Rituel : entre en mode ciblage.
    const t = getSpellTargets(state, card.instanceId);
    const hasTargets = (t.creatures?.length ?? 0) > 0 || t.face;
    if (!t.needsTarget) {
      doPlayCard(card.instanceId);
      clearSelection();
    } else if (hasTargets) {
      setSelectedAttacker(null);
      setPendingSpell({ instanceId: card.instanceId });
    }
    // Sinon (aucune cible dispo, ex. buff sans créature) : on ignore le clic.
  };

  const handleCreatureClick = (creature, side) => {
    if (!playing) return;

    // Mode rituel : la créature est une cible.
    if (pendingSpell) {
      if (targeting.creatures.has(creature.instanceId)) {
        doPlayCard(pendingSpell.instanceId, {
          type: 'creature',
          instanceId: creature.instanceId,
        });
        clearSelection();
      }
      return;
    }

    // Créature adverse cliquée alors qu'un attaquant est sélectionné → attaque.
    if (selectedAttacker && side === 'bot') {
      if (targeting.creatures.has(creature.instanceId)) {
        doAttack(selectedAttacker, { type: 'creature', instanceId: creature.instanceId });
        clearSelection();
      }
      return;
    }

    // Sélection / désélection d'un attaquant du joueur.
    if (side === 'player' && canAttack(state, 'player', creature.instanceId)) {
      setSelectedAttacker((cur) =>
        cur === creature.instanceId ? null : creature.instanceId
      );
    }
  };

  const handleFaceClick = (side) => {
    if (!playing) return;
    if (pendingSpell && side === 'bot' && targeting.botFace) {
      doPlayCard(pendingSpell.instanceId, { type: 'player', player: 'bot' });
      clearSelection();
      return;
    }
    if (selectedAttacker && side === 'bot' && targeting.botFace) {
      doAttack(selectedAttacker, { type: 'player' });
      clearSelection();
    }
  };

  const handleEndTurn = () => {
    clearSelection();
    doEndTurn();
  };

  // --- Rendu -----------------------------------------------------------------

  const { player, bot } = state.players;

  const modeHint = pendingSpell
    ? 'Choisissez une cible pour le rituel (ou appuyez sur Échap pour annuler).'
    : selectedAttacker
    ? 'Choisissez la cible de l’attaque : une créature adverse ou l’adversaire.'
    : 'Jouez des cartes, puis sélectionnez une créature pour attaquer.';

  return (
    <div
      className="game"
      onKeyDown={(e) => e.key === 'Escape' && clearSelection()}
      tabIndex={-1}
    >
      <div className="board-column">
        <PlayerBar
          name="Adversaire"
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

        <PlayerBar
          name="Vous"
          player={player}
          side="player"
          faceTargetable={false}
          onFaceClick={handleFaceClick}
        />

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
          <button
            type="button"
            className="end-turn"
            onClick={handleEndTurn}
            disabled={!playing}
          >
            Fin du tour ▶
          </button>
        </div>
      </div>

      <aside className="sidebar">
        <GameLog log={state.log} />
      </aside>

      {!playing && (
        <div className="overlay">
          <div className="overlay-box">
            <h1>{state.status === 'victory' ? '🏆 Victoire !' : '💀 Défaite'}</h1>
            <p>
              {state.status === 'victory'
                ? 'Vous avez vaincu l’adversaire.'
                : 'Vous avez été vaincu.'}
            </p>
            <button type="button" onClick={reset}>
              Rejouer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
