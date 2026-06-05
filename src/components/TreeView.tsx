import type { Dispatch } from 'react';
import type { Graph } from '../core/model';
import type { Action, GraphState } from '../state/graphReducer';
import { buildTree, type TreeRow } from '../graph/tree';
import './tree.css';

function Row({ row, state, dispatch, onSelect }: { row: TreeRow; state: GraphState; dispatch: Dispatch<Action>; onSelect: (k: string) => void }) {
  if (state.hiddenTypes.has(row.node.type.kind) || state.hiddenStatuses.has(row.node.status.category)) return null;
  const collapsed = state.collapsed.has(row.key);
  const hasChildren = row.children.length > 0;
  const kindVar = `var(--kind-${row.node.type.kind})`;
  return (
    <div className="tree-branch">
      <div className={`tree-row ${state.selectedKey === row.key ? 'sel' : ''}`} style={{ paddingLeft: row.depth * 20 + 8 }} onClick={() => onSelect(row.key)}>
        <button className="tcaret" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'toggleCollapsed', key: row.key }); }}>{hasChildren ? (collapsed ? '▸' : '▾') : '·'}</button>
        <span className="tk" style={{ color: kindVar }}>{row.key}</span>
        <span className="ts">{row.node.summary}</span>
        {row.links.map((b, i) => (
          <button key={i} className="tbadge" title={`${b.label} ${b.otherKey}`} onClick={(e) => { e.stopPropagation(); dispatch({ type: 'setFocus', key: b.otherKey }); dispatch({ type: 'select', key: b.otherKey }); }}>
            {b.relation === 'blocks' ? '⛔' : '↔'} {b.otherKey}
          </button>
        ))}
      </div>
      {!collapsed && row.children.map((c) => <Row key={c.key} row={c} state={state} dispatch={dispatch} onSelect={onSelect} />)}
    </div>
  );
}

export function TreeView({ graph, state, dispatch, onSelect }: { graph: Graph; state: GraphState; dispatch: Dispatch<Action>; onSelect: (k: string) => void }) {
  const rows = buildTree(graph);
  return <div className="tree">{rows.map((r) => <Row key={r.key} row={r} state={state} dispatch={dispatch} onSelect={onSelect} />)}</div>;
}
