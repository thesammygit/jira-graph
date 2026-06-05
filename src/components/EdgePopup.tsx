import { useEffect } from 'react';
import type { Dispatch } from 'react';
import type { Graph, GraphNode } from '../core/model';
import type { Action, GraphState } from '../state/graphReducer';
import { relationStyle } from '../graph/relation-colors';
import './edge-popup.css';

export function EdgePopup({ graph, state, dispatch }: { graph: Graph; state: GraphState; dispatch: Dispatch<Action> }) {
  const sel = state.selectedEdge;
  useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dispatch({ type: 'clearEdge' });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, dispatch]);
  if (!sel) return null;
  const src = graph.nodes.find((n) => n.key === sel.srcKey);
  const tgt = graph.nodes.find((n) => n.key === sel.tgtKey);
  if (!src || !tgt) return null;
  const rel = relationStyle(sel.relation);

  const Mini = ({ n }: { n: GraphNode }) => (
    <div className="ep-mini" style={{ borderLeftColor: `var(--kind-${n.type.kind})` }}>
      <div className="ep-k" style={{ color: `var(--kind-${n.type.kind})` }}>{n.key}</div>
      <div className="ep-s">{n.summary}</div>
      <div className="ep-meta"><span className="ep-pill" style={{ color: `var(--status-${n.status.category})` }}>{n.status.name}</span>{n.assignee && <span className="ep-av">{n.assignee.initials}</span>}</div>
    </div>
  );

  return (
    <>
      <div className="ep-scrim" onClick={() => dispatch({ type: 'clearEdge' })} />
      <div className="ep-pop" style={{ left: sel.x, top: sel.y }} role="dialog">
        <div className="ep-h">Relationship<button className="ep-x" onClick={() => dispatch({ type: 'clearEdge' })}>×</button></div>
        <Mini n={src} />
        <div className="ep-rel"><span className="ep-badge" style={{ background: rel.colorVar, color: '#fff' }}>{sel.label} ↓</span></div>
        <Mini n={tgt} />
        <div className="ep-phrase">"{src.key} <b>{sel.relation}</b> {tgt.key}"</div>
        <div className="ep-actions">
          <button onClick={() => dispatch({ type: 'openSpotlight', key: src.key })}>Spotlight {src.key}</button>
          <button onClick={() => dispatch({ type: 'openSpotlight', key: tgt.key })}>Spotlight {tgt.key}</button>
        </div>
        <div className="ep-open"><a href={src.url} target="_blank" rel="noreferrer">Open {src.key} ↗</a><a href={tgt.url} target="_blank" rel="noreferrer">Open {tgt.key} ↗</a></div>
      </div>
    </>
  );
}
