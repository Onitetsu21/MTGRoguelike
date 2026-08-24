import RunHud from './RunHud.jsx';
import CardView from './CardView.jsx';

const COLOR_NAMES = { W: 'Blanc', U: 'Bleu', B: 'Noir', R: 'Rouge', G: 'Vert' };

// Après une défaite de combat : lot de consolation (1 carte parmi 3), puis retry.
export default function ConsolationScreen({ run, cardDb, onPick }) {
  const { colors, choices } = run.pending.consolation;
  return (
    <div className="screen consolation-screen">
      <RunHud run={run} />
      <header className="screen-header">
        <h1>💀 Combat perdu — lot de consolation</h1>
        <p className="screen-sub">
          −20 PV max. Choisissez une carte ({colors.map((c) => COLOR_NAMES[c]).join(' / ')}) à
          ajouter à votre deck, puis retentez le combat.
        </p>
      </header>
      <div className="card-grid">
        {choices.map((id, i) => (
          <CardView key={`${id}-${i}`} def={cardDb[id]} onClick={() => onPick(id)} />
        ))}
      </div>
    </div>
  );
}
