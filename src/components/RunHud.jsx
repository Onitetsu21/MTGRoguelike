// Bandeau d'état du run, affiché sur les écrans hors combat.
export default function RunHud({ run }) {
  return (
    <div className="run-hud">
      <span className="hud-item hud-hp" title="PV courants / max">
        ❤ {run.currentHp}/{run.maxHp}
      </span>
      <span className="hud-item hud-gold" title="Or">🪙 {run.gold}</span>
      <span className="hud-item" title="Plafond de mana">🔷 {run.manaCap}</span>
      <span className="hud-item" title="Cartes dans le deck">🂠 {run.deck.length}</span>
      <span className="hud-item" title="Niveau">🗺 Niv. {run.level + 1}</span>
    </div>
  );
}
