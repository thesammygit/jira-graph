import { useEffect, useRef } from 'react';
import type { Dispatch } from 'react';
import type { Graph, GraphNode } from '../core/model';
import type { Action, GraphState } from '../state/graphReducer';
import { subtreeModel, type SubtreeNode } from '../graph/subtree';
import './tree-detail.css';

/** Full-detail view of the hierarchy tree the focused ticket lives in. */
export function TreeDetailView({ graph, state, dispatch }: { graph: Graph; state: GraphState; dispatch: Dispatch<Action> }) {
  const model = state.focusKey ? subtreeModel(graph, state.focusKey) : null;
  if (!model) {
    return <div className="td-empty">Pick a ticket first — click one in Overview or use "Focus a ticket" — then Tree shows everything in its hierarchy.</div>;
  }
  return (
    <div className="tree-detail">
      <div className="td-bar">
        <button onClick={() => dispatch({ type: 'setViewMode', viewMode: 'spotlight' })}>◎ Spotlight</button>
        <button onClick={() => dispatch({ type: 'setViewMode', viewMode: 'overview' })}>▦ Overview</button>
        <span className="td-title">
          Tree of <b style={{ color: `var(--kind-${model.root.node.type.kind})` }}>{model.root.node.key}</b> · {model.root.node.summary}
        </span>
      </div>
      <div className="td-body">
        <Branch item={model.root} focusKey={model.focusKey} depth={0} dispatch={dispatch} />
      </div>
    </div>
  );
}

function Branch({ item, focusKey, depth, dispatch }: { item: SubtreeNode; focusKey: string; depth: number; dispatch: Dispatch<Action> }) {
  return (
    <div className={`td-branch ${depth > 0 ? 'td-indented' : ''}`}>
      <Row node={item.node} focal={item.node.key === focusKey} dispatch={dispatch} />
      {item.children.map((c) => (
        <Branch key={c.node.key} item={c} focusKey={focusKey} depth={depth + 1} dispatch={dispatch} />
      ))}
    </div>
  );
}

function Row({ node, focal, dispatch }: { node: GraphNode; focal: boolean; dispatch: Dispatch<Action> }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focal) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focal, node.key]);
  const done = node.status.category === 'done';
  return (
    <button
      ref={ref}
      className={`td-row ${focal ? 'focal' : ''} ${done ? 'is-done' : ''}`}
      style={{ borderLeftColor: `var(--kind-${node.type.kind})` }}
      onClick={() => dispatch({ type: 'openSpotlight', key: node.key })}
      title="Open in Spotlight"
    >
      <span className="td-k" style={{ color: `var(--kind-${node.type.kind})` }}>{node.key}</span>
      <span className="td-s">{node.summary}</span>
      <span className="td-meta">
        {node.labels.slice(0, 2).map((l) => <span key={l} className="td-tag">{l}</span>)}
        {node.components.slice(0, 1).map((c) => <span key={c} className="td-tag td-comp">{c}</span>)}
        {node.storyPoints != null && <span className="td-pts">{node.storyPoints} pts</span>}
        <span className="td-pill" style={{ color: `var(--status-${node.status.category})` }}>{node.status.name}</span>
        {node.assignee && <span className="td-av" title={node.assignee.displayName}>{node.assignee.initials}</span>}
      </span>
    </button>
  );
}
