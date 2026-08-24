import RunHud from './RunHud.jsx';

// Écran d'événement simple : un effet, un bouton pour continuer.
export default function EventScreen({ run, event, onResolve }) {
  return (
    <div className="screen event-screen">
      <RunHud run={run} />
      <div className="event-card">
        <h1>❓ {event.name}</h1>
        <p className="event-text">{event.text}</p>
        <button type="button" onClick={onResolve}>
          Continuer ▶
        </button>
      </div>
    </div>
  );
}
