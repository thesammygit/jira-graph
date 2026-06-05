import type { Dispatch } from 'react';
import type { Graph, GraphNode } from '../core/model';
import type { Action } from '../state/graphReducer';

export function DetailPanel({ graph, selectedKey, dispatch }: { graph: Graph; selectedKey: string | null; dispatch: Dispatch<Action> }) {
  if (!selectedKey) return null;
  const node: GraphNode | undefined = graph.nodes.find((n) => n.key === selectedKey);
  if (!node) return null;
  const links = graph.edges.filter((e) => e.source === node.key || e.target === node.key);
  return (
    <aside className="detail">
      <button className="detail-close" onClick={() => dispatch({ type: 'select', key: null })}>×</button>
      <div className="detail-key">{node.key}</div>
      <h3 className="detail-summary">{node.summary}</h3>
      <dl className="detail-fields">
        <dt>Type</dt><dd>{node.type.name}</dd>
        <dt>Status</dt><dd>{node.status.name}</dd>
        {node.priority && <><dt>Priority</dt><dd>{node.priority}</dd></>}
        {node.assignee && <><dt>Assignee</dt><dd>{node.assignee.displayName}</dd></>}
        {node.storyPoints != null && <><dt>Points</dt><dd>{node.storyPoints}</dd></>}
      </dl>
      <div className="detail-links">
        <span className="tb-label">Relationships ({links.length})</span>
        <ul>
          {links.map((e) => (
            <li key={e.id}>
              <button onClick={() => dispatch({ type: 'setFocus', key: e.source === node.key ? e.target : e.source })}>
                {e.source === node.key ? `${e.label} → ${e.target}` : `${e.source} ${e.label} →`}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <a className="detail-open" href={node.url} target="_blank" rel="noreferrer">Open in Jira ↗</a>
    </aside>
  );
}
