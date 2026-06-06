import { useState, type Dispatch, type ReactNode } from 'react';
import type { Action, DoneDisplay, GraphState, GroupDepth, LinkLevel } from '../state/graphReducer';
import type { IssueKind, Graph } from '../core/model';
import type { Theme } from '../theme/useTheme';
import { Legend } from './Legend';
import { TicketTypeahead } from './TicketTypeahead';
import './sidebar.css';

const DEPTHS: GroupDepth[] = [1, 2, 3, 4];
const DEPTH_LABEL: Record<GroupDepth, string> = { 1: 'Epic', 2: 'Story', 3: 'Task', 4: 'Sub' };
const TYPES: IssueKind[] = ['epic', 'story', 'task', 'subtask', 'bug'];

const LINK_LEVELS: { id: LinkLevel; label: string; tip: string }[] = [
  { id: 'epic', label: 'Epic', tip: 'Only links between epics' },
  { id: 'story', label: 'Story', tip: 'Story-level and up — hides task/subtask link clutter' },
  { id: 'task', label: 'Task', tip: 'Task-level and up — hides only subtask links' },
  { id: 'all', label: 'All', tip: 'Every link' },
];

const DONE_MODES: { id: DoneDisplay; label: string; tip: string }[] = [
  { id: 'normal', label: 'Normal', tip: 'Done tickets look like any other' },
  { id: 'dim', label: 'Dim', tip: 'Fade completed tickets' },
  { id: 'strike', label: 'Strike', tip: 'Line through completed tickets' },
  { id: 'hide', label: 'Hide', tip: 'Remove completed tickets from every view' },
];

type Dataset = 'v3' | 'v2' | 'v2-no-epic' | 'large' | 'huge';
type SectionId = 'display' | 'filters' | 'legend';

const OPEN_KEY = 'jira-graph-sidebar-open';
function loadOpen(): Record<SectionId, boolean> {
  try {
    const stored = JSON.parse(localStorage.getItem(OPEN_KEY) ?? '');
    return { display: !!stored.display, filters: !!stored.filters, legend: !!stored.legend };
  } catch {
    return { display: true, filters: false, legend: true }; // sensible defaults
  }
}

const RAIL_KEY = 'jira-graph-sidebar-rail';

const MODES: { id: 'overview' | 'spotlight' | 'tree'; icon: string; label: string }[] = [
  { id: 'overview', icon: '▦', label: 'Overview' },
  { id: 'spotlight', icon: '◎', label: 'Spotlight' },
  { id: 'tree', icon: '⌥', label: 'Tree' },
];

export function Sidebar(props: {
  graph: Graph; state: GraphState; dispatch: Dispatch<Action>;
  theme: Theme; onToggleTheme: () => void; dataset: Dataset; onDataset: (d: Dataset) => void;
}) {
  const { graph, state, dispatch, theme, onToggleTheme, dataset, onDataset } = props;
  const canSpotlight = !!state.focusKey;
  const [open, setOpen] = useState<Record<SectionId, boolean>>(loadOpen);
  const toggleOpen = (id: SectionId) => setOpen((prev) => {
    const next = { ...prev, [id]: !prev[id] };
    try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });
  const [rail, setRail] = useState<boolean>(() => {
    try { return localStorage.getItem(RAIL_KEY) === '1'; } catch { return false; }
  });
  const toggleRail = () => setRail((v) => {
    try { localStorage.setItem(RAIL_KEY, v ? '0' : '1'); } catch { /* ignore */ }
    return !v;
  });

  if (rail) {
    // Collapsed: a slim icon rail — modes + theme + expand.
    return (
      <aside className="sidebar rail">
        <button className="sb-rail-btn sb-rail-logo" onClick={toggleRail} title="Expand sidebar">◳</button>
        <button className="sb-rail-btn" onClick={toggleRail} title="Expand sidebar" aria-label="Expand sidebar">»</button>
        {MODES.map((m) => (
          <button key={m.id} className={`sb-rail-btn ${state.viewMode === m.id ? 'on' : ''}`} title={m.label}
            onClick={() => dispatch({ type: 'setViewMode', viewMode: m.id })}>{m.icon}</button>
        ))}
        <div className="sb-rail-spacer" />
        <button className="sb-rail-btn" onClick={onToggleTheme} title="Toggle theme">{theme === 'dark' ? '☀' : '☾'}</button>
      </aside>
    );
  }

  const projects = Array.from(new Map(graph.nodes.map((n) => [n.project.key, n.project])).values());
  const assignees = Array.from(new Set(graph.nodes.map((n) => n.assignee?.displayName ?? '__unassigned__')));
  const labels = Array.from(new Set(graph.nodes.flatMap((n) => n.labels))).sort();
  const components = Array.from(new Set(graph.nodes.flatMap((n) => n.components))).sort();

  const hiddenCount =
    state.hiddenTypes.size + state.hiddenStatuses.size + state.hiddenProjects.size +
    state.hiddenAssignees.size + state.hiddenLabels.size + state.hiddenComponents.size +
    state.hiddenRelations.size;

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <span className="sb-logo">◳</span> Jira Graph
        <button className="sb-collapse" onClick={toggleRail} title="Collapse sidebar" aria-label="Collapse sidebar">«</button>
      </div>

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
          title={canSpotlight ? 'Focus view for a single ticket and its relationships' : 'Spotlight a ticket — click one in Overview or use search'}>
          <span className="sb-ico">◎</span>Spotlight
        </button>
        <button
          className={`sb-mode ${state.viewMode === 'tree' ? 'on' : ''}`}
          onClick={() => dispatch({ type: 'setViewMode', viewMode: 'tree' })}
          title={canSpotlight ? "The focused ticket's whole hierarchy, every ticket in detail" : 'Every tree — all epics and their tickets, collapsible'}>
          <span className="sb-ico">⌥</span>Tree
        </button>
      </nav>

      <TicketTypeahead graph={graph} dispatch={dispatch} />

      <Section id="display" title="Display" open={open.display} onToggle={toggleOpen}>
        {state.viewMode === 'overview' && (
          <Row label="Show" tip="Deepest ticket level shown — Epic shows only the epic boxes, Story adds their stories, and so on">
            <div className="sb-seg">{DEPTHS.map((d) => (
              <button key={d} className={state.groupDepth === d ? 'on' : ''} onClick={() => dispatch({ type: 'setGroupDepth', depth: d })}>{DEPTH_LABEL[d]}</button>
            ))}</div>
          </Row>
        )}
        <Row label="Links" tip="Hide low-level link clutter — a wire shows only when both tickets are at-or-above this level">
          <div className="sb-seg">{LINK_LEVELS.map((l) => (
            <button key={l.id} className={state.linkLevel === l.id ? 'on' : ''} title={l.tip}
              onClick={() => dispatch({ type: 'setLinkLevel', level: l.id })}>{l.label}</button>
          ))}</div>
        </Row>
        <Row label="Done" tip="How completed tickets render">
          <div className="sb-seg">{DONE_MODES.map((m) => (
            <button key={m.id} className={state.doneDisplay === m.id ? 'on' : ''} title={m.tip}
              onClick={() => dispatch({ type: 'setDoneDisplay', mode: m.id })}>{m.label}</button>
          ))}</div>
        </Row>
      </Section>

      <Section
        id="filters" title="Filters" open={open.filters} onToggle={toggleOpen}
        badge={hiddenCount > 0 ? `${hiddenCount} hidden` : undefined}
        action={hiddenCount > 0 ? { label: 'Clear', onClick: () => dispatch({ type: 'clearFilters' }) } : undefined}>
        <FilterGroup label="Projects">
          {projects.map((p) => (
            <button key={p.key} className={`sb-chip ${state.hiddenProjects.has(p.key) ? '' : 'on'}`}
              onClick={() => dispatch({ type: 'toggleProject', key: p.key })} title={p.name}>{p.key}</button>
          ))}
        </FilterGroup>
        <FilterGroup label="Types">
          {TYPES.map((t) => (
            <button key={t} className={`sb-chip ${state.hiddenTypes.has(t) ? '' : 'on'}`}
              onClick={() => dispatch({ type: 'toggleType', kind: t })}>{t}</button>
          ))}
        </FilterGroup>
        <FilterGroup label="People">
          {assignees.map((a) => (
            <button key={a} className={`sb-chip ${state.hiddenAssignees.has(a) ? '' : 'on'}`}
              onClick={() => dispatch({ type: 'toggleAssignee', name: a })}>
              {a === '__unassigned__' ? 'Unassigned' : a}
            </button>
          ))}
        </FilterGroup>
        {labels.length > 0 && (
          <FilterGroup label="Labels">
            {labels.map((l) => (
              <button key={l} className={`sb-chip ${state.hiddenLabels.has(l) ? '' : 'on'}`}
                onClick={() => dispatch({ type: 'toggleLabel', label: l })}>{l}</button>
            ))}
          </FilterGroup>
        )}
        {components.length > 0 && (
          <FilterGroup label="Components">
            {components.map((c) => (
              <button key={c} className={`sb-chip ${state.hiddenComponents.has(c) ? '' : 'on'}`}
                onClick={() => dispatch({ type: 'toggleComponent', name: c })}>{c}</button>
            ))}
          </FilterGroup>
        )}
      </Section>

      <Section id="legend" title="Legend" open={open.legend} onToggle={toggleOpen}>
        <Legend graph={graph} state={state} dispatch={dispatch} />
      </Section>

      <div className="sb-foot">
        <select className="sb-select" value={dataset} onChange={(e) => onDataset(e.target.value as Dataset)}>
          <option value="large">Large demo (3 projects)</option><option value="huge">Huge demo (~4k tickets)</option><option value="v3">Cloud v3</option><option value="v2">Server v2</option><option value="v2-no-epic">v2 · no Epic Link</option>
        </select>
        <button className="sb-theme" onClick={onToggleTheme} aria-label="Toggle theme">{theme === 'dark' ? '☀ Light' : '☾ Dark'}</button>
      </div>
    </aside>
  );
}

/** Collapsible sidebar group with an optional badge + header action. */
function Section({ id, title, open, onToggle, badge, action, children }: {
  id: SectionId; title: string; open: boolean; onToggle: (id: SectionId) => void;
  badge?: string; action?: { label: string; onClick: () => void }; children: ReactNode;
}) {
  return (
    <div className={`sb-acc ${open ? 'open' : ''}`}>
      <div className="sb-acc-head">
        <button className="sb-acc-toggle" onClick={() => onToggle(id)} aria-expanded={open}>
          <span className="sb-acc-chev">{open ? '▾' : '▸'}</span>{title}
          {badge && <span className="sb-badge">{badge}</span>}
        </button>
        {action && <button className="sb-clear" onClick={action.onClick}>{action.label}</button>}
      </div>
      {open && <div className="sb-acc-body">{children}</div>}
    </div>
  );
}

function Row({ label, tip, children }: { label: string; tip?: string; children: ReactNode }) {
  return (
    <div className="sb-row" title={tip}>
      <span className="sb-row-label">{label}</span>
      {children}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="sb-fgroup">
      <span className="sb-subhead">{label}</span>
      <div className="sb-chips">{children}</div>
    </div>
  );
}
