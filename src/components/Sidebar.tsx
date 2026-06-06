import type { Dispatch } from 'react';
import type { Action, GraphState, GroupDepth, LinkLevel } from '../state/graphReducer';

// Hide low-level link noise: a wire renders only when BOTH linked tickets are
// at-or-above this level (e.g. "Story" hides task↔task clutter).
const LINK_LEVELS: { id: LinkLevel; label: string; tip: string }[] = [
  { id: 'epic', label: 'Epic', tip: 'Only links between epics' },
  { id: 'story', label: 'Story', tip: 'Story-level and up — hides task/subtask link clutter' },
  { id: 'task', label: 'Task', tip: 'Task-level and up — hides only subtask links' },
  { id: 'all', label: 'All', tip: 'Every link' },
];
import type { IssueKind, Graph } from '../core/model';
import type { Theme } from '../theme/useTheme';
import { Legend } from './Legend';
import { TicketTypeahead } from './TicketTypeahead';
import './sidebar.css';

const DEPTHS: GroupDepth[] = [1, 2, 3, 4];
const DEPTH_LABEL: Record<GroupDepth, string> = { 1: 'Epic', 2: 'Story', 3: 'Task', 4: 'Subtask' };
const TYPES: IssueKind[] = ['epic', 'story', 'task', 'subtask', 'bug'];

type Dataset = 'v3' | 'v2' | 'v2-no-epic' | 'large';

export function Sidebar(props: {
  graph: Graph; state: GraphState; dispatch: Dispatch<Action>;
  theme: Theme; onToggleTheme: () => void; dataset: Dataset; onDataset: (d: Dataset) => void;
}) {
  const { graph, state, dispatch, theme, onToggleTheme, dataset, onDataset } = props;
  const canSpotlight = !!state.focusKey;
  return (
    <aside className="sidebar">
      <div className="sb-brand"><span className="sb-logo">◳</span> Jira Graph</div>

      <nav className="sb-modes">
        <button
          className={`sb-mode ${state.viewMode === 'overview' ? 'on' : ''}`}
          onClick={() => dispatch({ type: 'setViewMode', viewMode: 'overview' })}
          title="Grouped container board — epics, stories, tasks, subtasks">
          <span className="sb-ico">▦</span>Overview
        </button>
        <button
          className={`sb-mode ${state.viewMode === 'spotlight' ? 'on' : ''}`}
          onClick={() => dispatch({ type: 'setViewMode', viewMode: 'spotlight' })}
          title={canSpotlight ? 'Focus view for a single ticket and its relationships' : 'Spotlight a ticket — click one in Overview or use "Focus a ticket"'}>
          <span className="sb-ico">◎</span>Spotlight
        </button>
      </nav>

      <div className="sb-section">
        <span className="sb-label">Focus a ticket</span>
        <TicketTypeahead graph={graph} dispatch={dispatch} />
      </div>

      <div className="sb-section">
        <span className="sb-label">Search (highlight)</span>
        <input className="sb-search" placeholder="Search…" value={state.search}
          onChange={(e) => dispatch({ type: 'setSearch', query: e.target.value })} />
      </div>

      <div className="sb-section"><span className="sb-label">Depth</span>
        <div className="sb-seg">{DEPTHS.map((d) => (
          <button key={d} className={state.groupDepth === d ? 'on' : ''} onClick={() => dispatch({ type: 'setGroupDepth', depth: d })}>{DEPTH_LABEL[d]}</button>
        ))}</div>
      </div>

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
        <span className="sb-label" style={{ marginTop: 6 }}>Link detail</span>
        <div className="sb-seg">
          {LINK_LEVELS.map((l) => (
            <button key={l.id} className={state.linkLevel === l.id ? 'on' : ''} title={l.tip}
              onClick={() => dispatch({ type: 'setLinkLevel', level: l.id })}>{l.label}</button>
          ))}
        </div>
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
