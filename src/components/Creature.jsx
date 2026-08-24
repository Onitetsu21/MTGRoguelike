import { effectivePower, effectiveToughness, remainingToughness } from '../engine/index.js';

const KEYWORD_ICONS = {
  flying: { icon: '🕊', label: 'Vol' },
  trample: { icon: '🐾', label: 'Piétinement' },
  deathtouch: { icon: '☠', label: 'Toucher mortel' },
  lifelink: { icon: '✚', label: 'Lien de vie' },
  haste: { icon: '⚡', label: 'Célérité' },
  reach: { icon: '🏹', label: 'Portée' },
  initiative: { icon: '⚔', label: 'Initiative' },
  indestructible: { icon: '🛡', label: 'Indestructible' },
};

const ARCHETYPE_GLYPH = {
  azorius: '🐦', dimir: '🐀', rakdos: '🦎', gruul: '🦝', selesnya: '🐰',
  orzhov: '🦇', golgari: '🐿️', simic: '🐸', boros: '🐭', izzet: '🦦',
};

function frameColor(colors = []) {
  if (colors.length === 0) return 'colorless';
  if (colors.length >= 2) return 'multi';
  return `mono-${colors[0]}`;
}

// Créature sur le champ de bataille : jeton compact façon carte (cadre coloré,
// illustration placeholder, mots-clés, Force/Endurance effectives, dégâts).
export default function Creature({ creature, side, selectable, selected, targetable, onClick }) {
  const power = effectivePower(creature);
  const toughness = effectiveToughness(creature);
  const remaining = remainingToughness(creature);
  const buffed = creature.tempBuffs && creature.tempBuffs.length > 0;
  const color = frameColor(creature.colors);
  const glyph = ARCHETYPE_GLYPH[(creature.archetypes ?? [])[0]] ?? (creature.isToken ? '🔸' : '🎴');

  const classes = ['creature', `frame-${color}`, `creature--${side}`];
  if (selectable) classes.push('selectable');
  if (selected) classes.push('selected');
  if (targetable) classes.push('targetable');
  if (creature.markedDamage > 0) classes.push('wounded');
  if (side === 'player' && !creature.readyToAttack) classes.push('sick');

  const clickable = selectable || targetable;

  return (
    <button
      type="button"
      className={classes.join(' ')}
      onClick={() => clickable && onClick(creature, side)}
      disabled={!clickable}
    >
      <div className="creature-name">{creature.name}</div>

      <div className="creature-art">
        <span className="creature-glyph" aria-hidden="true">{glyph}</span>
        <span className="creature-keywords">
          {creature.keywords.map((k) => (
            <span key={k} title={KEYWORD_ICONS[k]?.label ?? k}>
              {KEYWORD_ICONS[k]?.icon ?? '•'}
            </span>
          ))}
          {side === 'player' && !creature.readyToAttack && (
            <span title="Mal d'invocation">💤</span>
          )}
        </span>
      </div>

      <div className="creature-bottom">
        <span className="creature-stats">
          <span className={buffed ? 'buffed' : ''}>{power}</span>
          <span className="slash">/</span>
          <span className={buffed ? 'buffed' : ''}>{toughness}</span>
        </span>
        {creature.markedDamage > 0 && (
          <span className="creature-damage" title="PV restants (dégâts persistants)">
            {remaining}♥
          </span>
        )}
      </div>
    </button>
  );
}
