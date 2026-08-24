import { currentBooster } from '../engine/index.js';
import CardView from './CardView.jsx';

// Écran de draft : boosters successifs, on prend une carte à la fois.
export default function DraftScreen({ draft, cardDb, onPick }) {
  const boosterCards = currentBooster(draft).map((id) => cardDb[id]);
  const totalBoosters = draft.boosters.length;

  return (
    <div className="screen draft-screen">
      <header className="screen-header">
        <h1>Draft du deck de départ</h1>
        <p className="screen-sub">
          Booster {draft.boosterIndex + 1}/{totalBoosters} · Prenez {draft.picksLeft} carte
          {draft.picksLeft > 1 ? 's' : ''} de plus · Deck : {draft.picked.length} carte
          {draft.picked.length > 1 ? 's' : ''}
        </p>
      </header>

      <div className="card-grid">
        {boosterCards.map((def, i) => (
          <CardView key={`${def.id}-${i}`} def={def} onClick={() => onPick(def.id)} />
        ))}
      </div>
    </div>
  );
}
