import RunHud from './RunHud.jsx';

const NODE_META = {
  combat: { icon: '⚔️', label: 'Combat' },
  shop: { icon: '🛒', label: 'Boutique' },
  event: { icon: '❓', label: 'Événement' },
  boss: { icon: '👑', label: 'Boss' },
};

// Carte de run à embranchements. Les nœuds accessibles sont cliquables.
export default function RunMapScreen({ run, onEnterNode }) {
  return (
    <div className="screen map-screen">
      <RunHud run={run} />
      <header className="screen-header">
        <h1>Niveau {run.level + 1}</h1>
        <p className="screen-sub">Choisissez votre prochaine étape.</p>
      </header>

      <div className="run-map">
        {run.map.rows.map((row, i) => (
          <div className="map-row" key={i}>
            {row.map((node) => {
              const meta = NODE_META[node.type] ?? { icon: '•', label: node.type };
              const reachable = run.reachable.includes(node.id);
              const visited = run.visited.includes(node.id);
              const classes = ['map-node', `node-${node.type}`];
              if (reachable) classes.push('reachable');
              if (visited) classes.push('visited');
              return (
                <button
                  key={node.id}
                  type="button"
                  className={classes.join(' ')}
                  disabled={!reachable}
                  onClick={() => reachable && onEnterNode(node.id)}
                >
                  <span className="node-icon">{meta.icon}</span>
                  <span className="node-label">{meta.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
