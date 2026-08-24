// Écrans simples : titre, victoire, game over.

export function TitleScreen({ onStart }) {
  return (
    <div className="screen title-screen">
      <div className="title-box">
        <h1>MTG Roguelike</h1>
        <p className="screen-sub">Draftez un deck, traversez 3 niveaux, terrassez les boss.</p>
        <button type="button" className="big-btn" onClick={onStart}>
          Nouveau run ▶
        </button>
      </div>
    </div>
  );
}

export function VictoryScreen({ onRestart }) {
  return (
    <div className="screen end-screen">
      <div className="title-box">
        <h1>🏆 Run terminé !</h1>
        <p className="screen-sub">Vous avez vaincu les trois boss. Bravo !</p>
        <button type="button" className="big-btn" onClick={onRestart}>
          Rejouer
        </button>
      </div>
    </div>
  );
}

export function GameOverScreen({ onRestart }) {
  return (
    <div className="screen end-screen">
      <div className="title-box">
        <h1>💀 Game over</h1>
        <p className="screen-sub">Vos PV max sont tombés à zéro. La run s'achève ici.</p>
        <button type="button" className="big-btn" onClick={onRestart}>
          Rejouer
        </button>
      </div>
    </div>
  );
}
