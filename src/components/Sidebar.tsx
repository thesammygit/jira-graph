import type { Dispatch } from 'react';
import type { Action, GraphState, ViewMode, GroupDepth } from '../state/graphReducer';
import type { LayoutKind } from '../graph/layouts';
import type { IssueKind, Graph } from '../core/model';
import type { Theme } from '../theme/useTheme';
import { Legend } from './Legend';
import { TicketTypeahead } from './TicketTypeahead';
import './sidebar.css';

const MODES: { id: ViewMode; label: string; icon: string }[] = [
  { id: 'graph', label: 'Graph', icon: '◫' }, { id: 'grouped', label: 'Grouped', icon: '▦' },
  { id: 'tree', label: 'Tree', icon: '☰' }, { id: 'timeline', label: 'Timeline', icon: '▭' },
];
const LAYOUTS: LayoutKind[] = ['hybrid', 'hierarchical', 'force'];
const DEPTHS: GroupDepth[] = [1, 2, 3, 4];
const DEPTH_LABEL: Record<GroupDepth, string> = { 1: 'Epic', 2: 'Story', 3: 'Task', 4: 'Subtask' };
const TYPES: IssueKind[] = ['epic', 'story', 'task', 'subtask', 'bug'];

type Dataset = 'v3' | 'v2' | 'v2-no-epic' | 'large';

export function Sidebar(props: {
  graph: Graph; state: GraphState; dispatch: Dispatch<Action>;
  theme: Theme; onToggleTheme: () => void; dataset: Dataset; onDataset: (d: Dataset) => void;
}) {
  const { graph, state, dispatch, theme, onToggleTheme, dataset, onDataset } = props;
  return (
    <aside className="sidebar">
      <div className="sb-brand"><span className="sb-logo">◳</span> Jira Graph</div>

      <nav className="sb-modes">
        {MODES.map((m) => (
          <button key={m.id} className={`sb-mode ${state.viewMode === m.id ? 'on' : ''}`}
            onClick={() => dispatch({ type: 'setViewMode', viewMode: m.id })}>
            <span className="sb-ico">{m.icon}</span>{m.label}
          </button>
        ))}
      </nav>

      <div className="sb-section">
        <span className="sb-label">Focus a ticket</span>
        <TicketTypeahead graph={graph} dispatch={dispatch} />
      </div>

      {state.mode === 'focus' && (
        <div className="sb-section">
          <button className="sb-exit-focus" onClick={() => dispatch({ type: 'setMode', mode: 'map' })}>← Exit focus{state.focusKey ? ` (${state.focusKey})` : ''}</button>
          <div className="sb-depth-row">
            <span className="sb-label">Depth {state.depth}</span>
            <input type="range" min={0} max={5} value={state.depth} onChange={(e) => dispatch({ type: 'setDepth', depth: Number(e.target.value) })} />
          </div>
        </div>
      )}

      <div className="sb-section">
        <span className="sb-label">Search (highlight)</span>
        <input className="sb-search" placeholder="Search…" value={state.search}
          onChange={(e) => dispatch({ type: 'setSearch', query: e.target.value })} />
      </div>

      {state.viewMode === 'grouped' && (
        <div className="sb-section"><span className="sb-label">Depth</span>
          <div className="sb-seg">{DEPTHS.map((d) => (
            <button key={d} className={state.groupDepth === d ? 'on' : ''} onClick={() => dispatch({ type: 'setGroupDepth', depth: d })}>{DEPTH_LABEL[d]}</button>
          ))}</div>
        </div>
      )}
      {state.viewMode === 'graph' && (
        <div className="sb-section"><span className="sb-label">Layout</span>
          <div className="sb-seg">{LAYOUTS.map((l) => (
            <button key={l} className={state.layout === l ? 'on' : ''} onClick={() => dispatch({ type: 'setLayout', layout: l })}>{l}</button>
          ))}</div>
        </div>
      )}

      <div className="sb-section"><span className="sb-label">Types</span>
        <div className="sb-chips">{TYPES.map((t) => (
          <button key={t} className={`sb-chip ${state.hiddenTypes.has(t) ? '' : 'on'}`} onClick={() => dispatch({ type: 'toggleType', kind: t })}>{t}</button>
        ))}</div>
      </div>

      {(() => {
        const projects = Array.from(new Map(graph.nodes.map((n) => [n.project.key, n.project])).values());
        if (projects.length === 0) return null;
        return (
          <div className="sb-section"><span className="sb-label">Projects</span>
            <div className="sb-chips">{projects.map((p) => (
              <button key={p.key} className={`sb-chip ${state.hiddenProjects.has(p.key) ? '' : 'on'}`}
                onClick={() => dispatch({ type: 'toggleProject', key: p.key })}
                title={p.name}>{p.key}</button>
            ))}</div>
          </div>
        );
      })()}

      {(() => {
        const assignees = Array.from(new Set(graph.nodes.map((n) => n.assignee?.displayName ?? '__unassigned__')));
        if (assignees.length === 0) return null;
        return (
          <div className="sb-section"><span className="sb-label">Assignees</span>
            <div className="sb-chips">{assignees.map((a) => (
              <button key={a} className={`sb-chip ${state.hiddenAssignees.has(a) ? '' : 'on'}`}
                onClick={() => dispatch({ type: 'toggleAssignee', name: a })}>
                {a === '__unassigned__' ? 'Unassigned' : a}
              </button>
            ))}</div>
          </div>
        );
      })()}

      <div className="sb-section"><span className="sb-label">Relationships</span>
        <Legend graph={graph} state={state} dispatch={dispatch} />
      </div>

      <div className="sb-foot">
        <select className="sb-select" value={dataset} onChange={(e) => onDataset(e.target.value as Dataset)}>
          <option value="large">Large demo (3 projects)</option><option value="v3">Cloud v3</option><option value="v2">Server v2</option><option value="v2-no-epic">v2 · no Epic Link</option>
        </select>
        <button className="sb-theme" onClick={onToggleTheme} aria-label="Toggle theme">{theme === 'dark' ? '☀ Light' : '☾ Dark'}</button>
      </div>
    </aside>
  );
}
