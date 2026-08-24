import { CARD_TYPES } from '../engine/index.js';

// Cadre de carte façon Magic : bandeau titre + coût, cartouche d'illustration,
// ligne de type, boîte de texte, encart Force/Endurance. Rendu à partir d'une
// définition OU d'une instance de carte (mêmes champs).

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
const RARITY_LABEL = { common: 'C', uncommon: 'U', rare: 'R', mythic: 'M' };

// Emoji d'illustration par archétype (placeholder tant qu'il n'y a pas d'image).
const ARCHETYPE_GLYPH = {
  azorius: '🐦', dimir: '🐀', rakdos: '🦎', gruul: '🦝', selesnya: '🐰',
  orzhov: '🦇', golgari: '🐿️', simic: '🐸', boros: '🐭', izzet: '🦦',
};

// Classe de couleur du cadre selon l'identité colorée.
function frameColor(colors = []) {
  if (colors.length === 0) return 'colorless';
  if (colors.length >= 2) return 'multi';
  return `mono-${colors[0]}`;
}

// Résout le chemin d'illustration locale (public/art/<id>.jpg) selon la base Vite.
function artSrc(art) {
  if (!art) return null;
  if (/^(https?:)?\/\//.test(art) || art.startsWith('/')) return art;
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
  return base + art;
}

function glyphFor(card) {
  const arch = (card.archetypes ?? [])[0];
  if (arch && ARCHETYPE_GLYPH[arch]) return ARCHETYPE_GLYPH[arch];
  if (card.type !== CARD_TYPES.CREATURE) return '✨';
  return '🎴';
}

export default function CardFrame({ card, onClick, disabled, selected, targetable, footer }) {
  const isCreature = card.type === CARD_TYPES.CREATURE;
  const color = frameColor(card.colors);
  const clickable = !!onClick && !disabled;

  const classes = ['mtg-card', `frame-${color}`, `rarity-${card.rarity ?? 'common'}`];
  if (disabled) classes.push('is-disabled');
  if (selected) classes.push('is-selected');
  if (targetable) classes.push('is-targetable');

  const keywordText = (card.keywords ?? []).map((k) => KEYWORD_LABELS[k] ?? k).join(', ');

  return (
    <div
      className={classes.join(' ')}
      onClick={() => clickable && onClick(card)}
      role={clickable ? 'button' : undefined}
      title={card.name}
    >
      <div className="mtg-titlebar">
        <span className="mtg-name">{card.name}</span>
        <span className={`mtg-cost pip-${color}`}>{card.cost}</span>
      </div>

      <div className="mtg-art">
        {card.art && (
          <img
            className="mtg-art-img"
            src={artSrc(card.art)}
            alt=""
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
        <span className="mtg-art-glyph" aria-hidden="true">
          {glyphFor(card)}
        </span>
      </div>

      <div className="mtg-typeline">
        <span>
          {isCreature ? 'Créature' : 'Rituel'}
          {card.colors?.length > 0 && (
            <span className="mtg-colors-inline"> · {card.colors.map((c) => COLOR_NAMES[c]).join(' ')}</span>
          )}
        </span>
        <span className={`mtg-setgem gem-${card.rarity ?? 'common'}`}>{RARITY_LABEL[card.rarity ?? 'common']}</span>
      </div>

      <div className="mtg-textbox">
        {keywordText && <p className="mtg-keywords">{keywordText}</p>}
        {card.text && <p className="mtg-rules">{card.text}</p>}
      </div>

      {isCreature && (
        <div className="mtg-pt">
          {card.power}/{card.toughness}
        </div>
      )}

      {footer && <div className="mtg-footer">{footer}</div>}
    </div>
  );
}
