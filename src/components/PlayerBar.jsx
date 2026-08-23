import { MANA_CAP } from '../engine/index.js';

// Barre d'état d'un joueur : PV, mana, taille de deck et cimetière.
// Le "visage" (portrait) est cliquable quand il est une cible valide.
export default function PlayerBar({ name, player, side, faceTargetable, onFaceClick }) {
  const manaPips = [];
  for (let i = 0; i < MANA_CAP; i++) {
    let cls = 'mana-pip';
    if (i < player.mana) cls += ' filled';
    else if (i < player.maxMana) cls += ' spent';
    manaPips.push(<span key={i} className={cls} />);
  }

  const faceClasses = ['player-face'];
  if (faceTargetable) faceClasses.push('targetable');

  return (
    <div className={`player-bar player-bar--${side}`}>
      <button
        type="button"
        className={faceClasses.join(' ')}
        onClick={() => faceTargetable && onFaceClick(side)}
        disabled={!faceTargetable}
        title={faceTargetable ? 'Attaquer / cibler l’adversaire' : name}
      >
        <span className="player-name">{name}</span>
        <span className="player-hp">❤ {player.hp}</span>
      </button>

      <div className="player-info">
        <div className="mana-row" title={`${player.mana}/${player.maxMana} mana`}>
          {manaPips}
          <span className="mana-text">
            {player.mana}/{player.maxMana}
          </span>
        </div>
        <div className="pile-counts">
          <span title="Cartes dans le deck">🂠 {player.deck.length}</span>
          <span title="Cartes en main">✋ {player.hand.length}</span>
          <span title="Cimetière">⚰ {player.graveyard.length}</span>
        </div>
      </div>
    </div>
  );
}
