// Journal de combat. Affiche les événements les plus récents en premier.
export default function GameLog({ log }) {
  const entries = [...log].reverse();
  return (
    <div className="game-log">
      <h2>Journal</h2>
      <ul>
        {entries.map((e, i) => (
          <li key={log.length - i} className={`log-${e.actor}`}>
            {e.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
