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

const COLOR_NAMES = { W: 'Blanc', U: 'Bleu', B: 'Noir', R: 'Rouge', G: 'Vert' };

// Affichage statique d'une carte à partir de sa définition (cardDb).
// Utilisé par le draft, la boutique et le lot de consolation.
export default function CardView({ def, onClick, disabled, selected, footer }) {
  const classes = ['card', `rarity-${def.rarity}`];
  if (disabled) classes.push('unplayable');
  if (selected) classes.push('selected');
  const isCreature = def.type === CARD_TYPES.CREATURE;
  const clickable = !!onClick && !disabled;

  return (
    <div className={classes.join(' ')} onClick={() => clickable && onClick(def)} role={clickable ? 'button' : undefined}>
      <div className="card-top">
        <span className="card-name">{def.name}</span>
        <span className="card-cost">{def.cost}</span>
      </div>

      <div className="card-colors">
        {(def.colors ?? []).map((c) => (
          <span key={c} className={`color-dot color-${c}`} title={COLOR_NAMES[c]} />
        ))}
      </div>

      <div className="card-body">
        <span className="card-type">{isCreature ? 'Créature' : 'Rituel'}</span>
        <p className="card-text">{def.text}</p>
      </div>

      {isCreature ? (
        <div className="card-stats">
          {def.power}/{def.toughness}
          {def.keywords?.length > 0 && (
            <span className="card-keywords">
              {def.keywords.map((k) => KEYWORD_LABELS[k] ?? k).join(' · ')}
            </span>
          )}
        </div>
      ) : (
        <div className="card-stats card-stats--spell">Rituel</div>
      )}

      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}
