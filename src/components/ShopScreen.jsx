import RunHud from './RunHud.jsx';
import CardView from './CardView.jsx';

// Boutique : cartes, booster, plafond de mana, soin.
export default function ShopScreen({ run, cardDb, onBuyCard, onBuyManaCap, onBuyHeal, onBuyBooster, onPickBooster, onLeave }) {
  const offers = run.pending.offers;
  const boosterPick = run.pending.boosterPick;

  return (
    <div className="screen shop-screen">
      <RunHud run={run} />
      <header className="screen-header">
        <h1>🛒 Boutique</h1>
        <p className="screen-sub">Dépensez votre or judicieusement.</p>
      </header>

      {boosterPick ? (
        <section className="shop-section">
          <h2>Booster ouvert — choisissez une carte</h2>
          <div className="card-grid">
            {boosterPick.choices.map((id, i) => (
              <CardView key={`${id}-${i}`} def={cardDb[id]} onClick={() => onPickBooster(id)} />
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="shop-section">
            <h2>Cartes à acheter</h2>
            <div className="card-grid">
              {offers.cards.length === 0 && <span className="empty-hint">Plus rien à vendre.</span>}
              {offers.cards.map((c) => {
                const affordable = run.gold >= c.price;
                return (
                  <CardView
                    key={c.cardId}
                    def={cardDb[c.cardId]}
                    disabled={!affordable}
                    onClick={affordable ? () => onBuyCard(c.cardId) : undefined}
                    footer={<span className="price">🪙 {c.price}</span>}
                  />
                );
              })}
            </div>
          </section>

          <section className="shop-actions">
            <button type="button" disabled={run.gold < offers.booster.price} onClick={onBuyBooster}>
              🎴 Booster (3 cartes, garde 1) — 🪙 {offers.booster.price}
            </button>
            {offers.manaCap ? (
              <button type="button" disabled={run.gold < offers.manaCap.price} onClick={onBuyManaCap}>
                🔷 +1 plafond de mana — 🪙 {offers.manaCap.price}
              </button>
            ) : (
              <button type="button" disabled>
                🔷 Plafond de mana au max
              </button>
            )}
            <button
              type="button"
              disabled={run.gold < offers.heal.price || run.currentHp >= run.maxHp}
              onClick={onBuyHeal}
            >
              ❤ +{offers.heal.hp} PV — 🪙 {offers.heal.price}
            </button>
          </section>

          <button type="button" className="leave-btn" onClick={onLeave}>
            Quitter la boutique ▶
          </button>
        </>
      )}
    </div>
  );
}
