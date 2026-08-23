import { effectivePower, effectiveToughness, remainingToughness } from '../engine/index.js';

const KEYWORD_ICONS = {
  flying: { icon: '🕊', label: 'Vol' },
  trample: { icon: '🐾', label: 'Piétinement' },
  deathtouch: { icon: '☠', label: 'Toucher mortel' },
};

// Créature posée sur le champ de bataille.
export default function Creature({ creature, side, selectable, selected, targetable, onClick }) {
  const power = effectivePower(creature);
  const toughness = effectiveToughness(creature);
  const remaining = remainingToughness(creature);
  const buffed = creature.tempBuffs && creature.tempBuffs.length > 0;

  const classes = ['creature', `creature--${side}`];
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

      <div className="creature-keywords">
        {creature.keywords.map((k) => (
          <span key={k} title={KEYWORD_ICONS[k]?.label ?? k}>
            {KEYWORD_ICONS[k]?.icon ?? '•'}
          </span>
        ))}
        {side === 'player' && !creature.readyToAttack && (
          <span title="Mal d'invocation : ne peut pas attaquer ce tour">💤</span>
        )}
      </div>

      <div className="creature-stats">
        <span className={buffed ? 'buffed' : ''}>{power}</span>
        <span className="slash">/</span>
        <span className={buffed ? 'buffed' : ''}>{toughness}</span>
      </div>

      {creature.markedDamage > 0 && (
        <div className="creature-damage" title="Dégâts marqués (persistants)">
          {remaining} PV restant{remaining > 1 ? 's' : ''}
        </div>
      )}
    </button>
  );
}
