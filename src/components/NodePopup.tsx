import { useEffect } from 'react';
import type { Dispatch } from 'react';
import type { Graph } from '../core/model';
import type { Action, GraphState } from '../state/graphReducer';
import { ticketRelationships } from '../graph/relationships';
import { relationStyle } from '../graph/relation-colors';
import './node-popup.css';

export function NodePopup({ graph, state, dispatch }: { graph: Graph; state: GraphState; dispatch: Dispatch<Action> }) {
  const sel = state.nodePopup;
  useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dispatch({ type: 'closeNode' });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, dispatch]);
  if (!sel) return null;
  const node = graph.nodes.find((n) => n.key === sel.key);
  if (!node) return null;
  const rels = ticketRelationships(graph, node.key);
  return (
    <>
      <div className="np-scrim" onClick={() => dispatch({ type: 'closeNode' })} />
      <div className="np-pop" style={{ left: sel.x, top: sel.y }} role="dialog">
        <div className="np-head">
          <span className="np-k" style={{ color: `var(--kind-${node.type.kind})` }}>{node.key}</span>
          <span className="np-type">{node.type.name}{node.priority ? ` · ${node.priority}` : ''}</span>
          <button className="np-x" onClick={() => dispatch({ type: 'closeNode' })}>×</button>
        </div>
        <h3 className="np-title">{node.summary}</h3>
        <div className="np-meta">
          <span className="np-pill" style={{ color: `var(--status-${node.status.category})` }}>{node.status.name}</span>
          {node.epicKey && node.type.kind !== 'epic' && <span className="np-epic" title={node.epicSummary}>▣ {node.epicKey}</span>}
          {node.storyPoints != null && <span className="np-pts">{node.storyPoints} pts</span>}
          {node.assignee && <span className="np-av" title={node.assignee.displayName}>{node.assignee.initials}</span>}
        </div>
        {node.description && <p className="np-desc">{node.description}</p>}
        <div className="np-rels">
          <span className="np-label">Relationships ({rels.length})</span>
          <ul>
            {rels.map((r, i) => {
              const c = relationStyle(r.kind === 'hierarchy' ? 'hierarchy' : r.relation).colorVar;
              const arrow = r.kind === 'hierarchy' ? '▸' : r.outward ? '→' : '←';
              const verb = r.outward ? r.label : `${r.label} (in)`;
              return (
                <li key={i}>
                  <button onClick={() => dispatch({ type: 'openNode', key: r.otherKey, x: sel.x, y: sel.y })}>
                    <span className="np-swatch" style={{ background: c }} /> {verb} {arrow} <b>{r.otherKey}</b>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="np-actions">
          <button className="np-focus" onClick={() => dispatch({ type: 'setFocus', key: node.key })}>Focus this ticket</button>
          <a className="np-open" href={node.url} target="_blank" rel="noreferrer">Open in Jira ↗</a>
        </div>
      </div>
    </>
  );
}
