import { useRun } from './hooks/useRun.js';
import DraftScreen from './components/DraftScreen.jsx';
import RunMapScreen from './components/RunMapScreen.jsx';
import CombatScreen from './components/CombatScreen.jsx';
import ShopScreen from './components/ShopScreen.jsx';
import EventScreen from './components/EventScreen.jsx';
import ConsolationScreen from './components/ConsolationScreen.jsx';
import { TitleScreen, VictoryScreen, GameOverScreen } from './components/SimpleScreens.jsx';

// Routeur d'écrans du run. La logique de jeu vit dans le moteur (via useRun) ;
// ce composant se contente d'afficher l'écran correspondant à l'état courant.
export default function App() {
  const rn = useRun();
  const { phase, draft, run, combat, content } = rn;
  const cardDb = content.cardDb;

  if (phase === 'title') return <TitleScreen onStart={rn.startDraft} />;
  if (phase === 'draft') return <DraftScreen draft={draft} cardDb={cardDb} onPick={rn.pickDraft} />;
  if (!run) return null;

  switch (run.status) {
    case 'combat':
      if (!combat) return <div className="screen"><p className="screen-sub">Préparation du combat…</p></div>;
      return (
        <CombatScreen
          state={combat}
          run={run}
          onPlayCard={rn.combatPlay}
          onAttack={rn.combatAttack}
          onEndTurn={rn.combatEndTurn}
          onFinish={rn.finishCombat}
        />
      );
    case 'map':
      return <RunMapScreen run={run} onEnterNode={rn.goToNode} />;
    case 'shop':
      return (
        <ShopScreen
          run={run}
          cardDb={cardDb}
          onBuyCard={rn.shopBuyCard}
          onBuyManaCap={rn.shopBuyManaCap}
          onBuyHeal={rn.shopBuyHeal}
          onBuyBooster={rn.shopBuyBooster}
          onPickBooster={rn.shopPickBooster}
          onLeave={rn.shopLeave}
        />
      );
    case 'event':
      return <EventScreen run={run} event={content.events[run.pending.eventId]} onResolve={rn.resolveEvent} />;
    case 'defeat_reward':
      return <ConsolationScreen run={run} cardDb={cardDb} onPick={rn.chooseConsolation} />;
    case 'victory':
      return <VictoryScreen onRestart={rn.restart} />;
    case 'game_over':
      return <GameOverScreen onRestart={rn.restart} />;
    default:
      return null;
  }
}
