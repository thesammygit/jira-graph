import { useEffect, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import type { Graph, GraphNode } from '../core/model';
import type { Action, GraphState } from '../state/graphReducer';
import { forestModel, subtreeModel, type SubtreeNode } from '../graph/subtree';
import './tree-detail.css';

/**
 * Full-detail hierarchy view. With a focused ticket it shows that ticket's
 * whole tree (focus highlighted); with no focus it shows EVERY tree — all
 * epics and loose tickets. Any branch with children can be collapsed.
 */
export function TreeDetailView({ graph, state, dispatch }: { graph: Graph; state: GraphState; dispatch: Dispatch<Action> }) {
  // Collapsed branches are view-local: leaving Tree and coming back starts fresh.
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const toggle = (key: string) => setClosed((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const model = state.focusKey ? subtreeModel(graph, state.focusKey) : null;
  const trees = model ? [model.root] : forestModel(graph);
  const focusKey = model?.focusKey ?? '';

  return (
    <div className="tree-detail">
      <div className="td-bar">
        <button onClick={() => dispatch({ type: 'setViewMode', viewMode: 'spotlight' })}>◎ Spotlight</button>
        <button onClick={() => dispatch({ type: 'setViewMode', viewMode: 'overview' })}>▦ Overview</button>
        {model ? (
          <span className="td-title">
            Tree of <b style={{ color: `var(--kind-${model.root.node.type.kind})` }}>{model.root.node.key}</b> · {model.root.node.summary}
          </span>
        ) : (
          <span className="td-title">All trees · click a ticket to open it in Spotlight</span>
        )}
      </div>
      <div className="td-body">
        {trees.map((t) => (
          <Branch key={t.node.key} item={t} focusKey={focusKey} depth={0} closed={closed} onToggle={toggle} dispatch={dispatch} />
        ))}
      </div>
    </div>
  );
}

function countDescendants(item: SubtreeNode): number {
  return item.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0);
}

function Branch({ item, focusKey, depth, closed, onToggle, dispatch }: {
  item: SubtreeNode; focusKey: string; depth: number;
  closed: Set<string>; onToggle: (key: string) => void; dispatch: Dispatch<Action>;
}) {
  const hasKids = item.children.length > 0;
  const isClosed = closed.has(item.node.key);
  return (
    <div className={`td-branch ${depth > 0 ? 'td-indented' : ''}`}>
      <div className="td-rowline">
        {hasKids ? (
          <button className="td-caret" onClick={() => onToggle(item.node.key)}
            aria-expanded={!isClosed} aria-label={isClosed ? 'Expand' : 'Collapse'}>
            {isClosed ? '▸' : '▾'}
          </button>
        ) : (
          <span className="td-caret td-caret-blank" />
        )}
        <Row node={item.node} focal={item.node.key === focusKey} dispatch={dispatch} />
        {isClosed && <span className="td-hidden-count">{countDescendants(item)} hidden</span>}
      </div>
      {!isClosed && item.children.map((c) => (
        <Branch key={c.node.key} item={c} focusKey={focusKey} depth={depth + 1} closed={closed} onToggle={onToggle} dispatch={dispatch} />
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
