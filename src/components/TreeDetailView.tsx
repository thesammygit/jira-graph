import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import type { Graph, GraphNode } from '../core/model';
import type { Action, GraphState } from '../state/graphReducer';
import { forestModel, subtreeModel, type SubtreeNode } from '../graph/subtree';
import './tree-detail.css';

const VIRTUAL_THRESHOLD = 200; // rows — below this, plain nested rendering
const ROW_H = 46;              // fixed row pitch in virtual mode
const OVERSCAN = 8;

/**
 * Full-detail hierarchy view. With a focused ticket it shows that ticket's
 * whole tree (focus highlighted); with no focus it shows EVERY tree — all
 * epics and loose tickets. Any branch with children can be collapsed.
 * Trees past a couple hundred rows render through a scroll window
 * (virtualized) so thousands of tickets stay smooth.
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
  const trees = useMemo(
    () => (model ? [model.root] : forestModel(graph)),
    [graph, model?.root.node.key], // eslint-disable-line react-hooks/exhaustive-deps
  );
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
      <TreeBody trees={trees} focusKey={focusKey} closed={closed} onToggle={toggle} dispatch={dispatch} />
    </div>
  );
}

interface FlatRow { node: GraphNode; depth: number; hasKids: boolean; isClosed: boolean; hiddenCount: number }

function countDescendants(item: SubtreeNode): number {
  return item.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0);
}

function flatten(trees: SubtreeNode[], closed: Set<string>): FlatRow[] {
  const rows: FlatRow[] = [];
  const walk = (item: SubtreeNode, depth: number) => {
    const hasKids = item.children.length > 0;
    const isClosed = closed.has(item.node.key);
    rows.push({ node: item.node, depth, hasKids, isClosed, hiddenCount: isClosed ? countDescendants(item) : 0 });
    if (!isClosed) for (const c of item.children) walk(c, depth + 1);
  };
  for (const t of trees) walk(t, 0);
  return rows;
}

function TreeBody({ trees, focusKey, closed, onToggle, dispatch }: {
  trees: SubtreeNode[]; focusKey: string; closed: Set<string>;
  onToggle: (key: string) => void; dispatch: Dispatch<Action>;
}) {
  const rows = useMemo(() => flatten(trees, closed), [trees, closed]);

  if (rows.length <= VIRTUAL_THRESHOLD) {
    // Small tree: nested rendering, exactly the pre-virtualization look.
    return (
      <div className="td-body">
        {trees.map((t) => (
          <Branch key={t.node.key} item={t} focusKey={focusKey} depth={0} closed={closed} onToggle={onToggle} dispatch={dispatch} />
        ))}
      </div>
    );
  }
  return <VirtualRows rows={rows} focusKey={focusKey} onToggle={onToggle} dispatch={dispatch} />;
}

function VirtualRows({ rows, focusKey, onToggle, dispatch }: {
  rows: FlatRow[]; focusKey: string; onToggle: (key: string) => void; dispatch: Dispatch<Action>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setViewH(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Center the focal ticket once per focus change.
  useEffect(() => {
    if (!focusKey || !ref.current) return;
    const idx = rows.findIndex((r) => r.node.key === focusKey);
    if (idx >= 0) ref.current.scrollTop = Math.max(0, idx * ROW_H - ref.current.clientHeight / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(rows.length, Math.ceil((scrollTop + viewH) / ROW_H) + OVERSCAN);

  return (
    <div className="td-body td-virtual" ref={ref} onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}>
      <div style={{ height: rows.length * ROW_H, position: 'relative' }}>
        {rows.slice(start, end).map((r, i) => {
          const idx = start + i;
          return (
            <div key={r.node.key} className="td-vrow" style={{ top: idx * ROW_H, height: ROW_H }}>
              {/* ancestor guide lines keep the nested look */}
              {Array.from({ length: r.depth }, (_, d) => (
                <span key={d} className="td-guide" />
              ))}
              <RowLine row={r} focal={r.node.key === focusKey} onToggle={onToggle} dispatch={dispatch} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RowLine({ row, focal, onToggle, dispatch }: { row: FlatRow; focal: boolean; onToggle: (key: string) => void; dispatch: Dispatch<Action> }) {
  return (
    <div className="td-rowline">
      {row.hasKids ? (
        <button className="td-caret" onClick={() => onToggle(row.node.key)}
          aria-expanded={!row.isClosed} aria-label={row.isClosed ? 'Expand' : 'Collapse'}>
          {row.isClosed ? '▸' : '▾'}
        </button>
      ) : (
        <span className="td-caret td-caret-blank" />
      )}
      <Row node={row.node} focal={focal} dispatch={dispatch} />
      {row.isClosed && <span className="td-hidden-count">{row.hiddenCount} hidden</span>}
    </div>
  );
}

function Branch({ item, focusKey, depth, closed, onToggle, dispatch }: {
  item: SubtreeNode; focusKey: string; depth: number;
  closed: Set<string>; onToggle: (key: string) => void; dispatch: Dispatch<Action>;
}) {
  const hasKids = item.children.length > 0;
  const isClosed = closed.has(item.node.key);
  return (
    <div className={`td-branch ${depth > 0 ? 'td-indented' : ''}`}>
      <RowLine
        row={{ node: item.node, depth, hasKids, isClosed, hiddenCount: isClosed ? countDescendants(item) : 0 }}
        focal={item.node.key === focusKey} onToggle={onToggle} dispatch={dispatch}
      />
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
