import { CARD_TYPES } from '../engine/index.js';

const KEYWORD_LABELS = {
  flying: 'Vol',
  trample: 'Piétinement',
  deathtouch: 'Toucher mortel',
  lifelink: 'Lien de vie',
  haste: 'Célérité',
  reach: 'Portée',
  initiative: 'Initiative',
  indestructible: 'Indestructible',
};

// Carte de la main du joueur.
export default function Card({ card, playable, selected, onClick }) {
  const classes = ['card', `rarity-${card.rarity}`];
  if (!playable) classes.push('unplayable');
  if (selected) classes.push('selected');

  const isCreature = card.type === CARD_TYPES.CREATURE;

  return (
    <button
      type="button"
      className={classes.join(' ')}
      onClick={() => playable && onClick(card)}
      disabled={!playable}
      title={card.text}
    >
      <div className="card-top">
        <span className="card-name">{card.name}</span>
        <span className="card-cost">{card.cost}</span>
      </div>

      <div className="card-body">
        <span className="card-type">{isCreature ? 'Créature' : 'Rituel'}</span>
        <p className="card-text">{card.text}</p>
      </div>

      {isCreature ? (
        <div className="card-stats">
          {card.power}/{card.toughness}
          {card.keywords.length > 0 && (
            <span className="card-keywords">
              {card.keywords.map((k) => KEYWORD_LABELS[k] ?? k).join(' · ')}
            </span>
          )}
        </div>
      ) : (
        <div className="card-stats card-stats--spell">Rituel</div>
      )}
    </button>
  );
}
