import CardFrame from './CardFrame.jsx';

// Carte de la main du joueur (cadre Magic + états jouable/sélectionné).
export default function Card({ card, playable, selected, onClick }) {
  return (
    <CardFrame
      card={card}
      disabled={!playable}
      selected={selected}
      onClick={playable ? onClick : undefined}
    />
  );
}
