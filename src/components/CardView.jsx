import CardFrame from './CardFrame.jsx';

// Affichage d'une carte depuis sa définition (draft, boutique, consolation).
// Simple délégation au cadre Magic partagé.
export default function CardView({ def, onClick, disabled, selected, footer }) {
  return (
    <CardFrame
      card={def}
      onClick={onClick ? () => onClick(def) : undefined}
      disabled={disabled}
      selected={selected}
      footer={footer}
    />
  );
}
