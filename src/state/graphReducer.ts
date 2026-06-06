import type { GraphNode, IssueKind, StatusCategory } from '../core/model';

export type ViewMode = 'overview' | 'spotlight' | 'tree';
/** How completed (Done) tickets render: normal, dimmed, struck-through, or hidden. */
export type DoneDisplay = 'normal' | 'dim' | 'strike' | 'hide';
export type GroupDepth = 1 | 2 | 3 | 4;
/** Minimum hierarchy level a link's TICKETS must have for the wire to render:
 *  'epic' = only epic↔epic, 'story' = story-and-up, 'task' = hide subtask links, 'all' = everything. */
export type LinkLevel = 'epic' | 'story' | 'task' | 'all';

export interface GraphState {
  viewMode: ViewMode;
  focusKey: string | null;
  focusHistory: string[];
  groupDepth: GroupDepth;
  collapsed: Set<string>;
  hiddenTypes: Set<IssueKind>;
  hiddenStatuses: Set<StatusCategory>;
  hiddenProjects: Set<string>;
  hiddenAssignees: Set<string>;
  hiddenRelations: Set<string>;
  linkLevel: LinkLevel;
  hiddenLabels: Set<string>;
  hiddenComponents: Set<string>;
  doneDisplay: DoneDisplay;
  search: string;
  selectedKey: string | null;
  selectedEdge: { id: string; x: number; y: number; srcKey: string; tgtKey: string; relation: string; label: string } | null;
  /** Pending "zoom to this ticket in Overview" request; `n` bumps so repeat
   *  reveals of the same key still re-trigger the zoom effect. */
  reveal: { key: string; n: number } | null;
}

export const initialState: GraphState = {
  viewMode: 'overview', focusKey: null, focusHistory: [],
  groupDepth: 4, collapsed: new Set(),
  hiddenTypes: new Set(), hiddenStatuses: new Set(), hiddenProjects: new Set(), hiddenAssignees: new Set(), hiddenRelations: new Set(),
  linkLevel: 'all',
  hiddenLabels: new Set(), hiddenComponents: new Set(),
  doneDisplay: 'normal',
  search: '', selectedKey: null, selectedEdge: null, reveal: null,
};

export type Action =
  | { type: 'setViewMode'; viewMode: ViewMode }
  | { type: 'openSpotlight'; key: string }
  | { type: 'spotlightBack' }
  | { type: 'setGroupDepth'; depth: GroupDepth }
  | { type: 'toggleCollapsed'; key: string }
  | { type: 'toggleType'; kind: IssueKind }
  | { type: 'toggleStatus'; status: StatusCategory }
  | { type: 'toggleProject'; key: string }
  | { type: 'toggleAssignee'; name: string }
  | { type: 'toggleRelation'; relation: string }
  | { type: 'setLinkLevel'; level: LinkLevel }
  | { type: 'toggleLabel'; label: string }
  | { type: 'toggleComponent'; name: string }
  | { type: 'setDoneDisplay'; mode: DoneDisplay }
  | { type: 'clearFilters' }
  | { type: 'revealInOverview'; node: GraphNode; minDepth: GroupDepth; ancestors: string[] }
  | { type: 'setSearch'; query: string }
  | { type: 'select'; key: string | null }
  | { type: 'selectEdge'; id: string; x: number; y: number; srcKey: string; tgtKey: string; relation: string; label: string }
  | { type: 'clearEdge' };

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
}

export function reducer(state: GraphState, action: Action): GraphState {
  switch (action.type) {
    case 'setViewMode': return { ...state, viewMode: action.viewMode };
    case 'openSpotlight': {
      // Breadcrumb rules: a click from Overview starts a FRESH trail; revisiting a
      // crumb TRUNCATES back to it; otherwise the previous hero is appended. The
      // trail therefore never contains duplicates.
      let focusHistory: string[];
      if (state.viewMode === 'overview') focusHistory = [];
      else if (state.focusKey === action.key) focusHistory = state.focusHistory;
      else {
        const revisit = state.focusHistory.indexOf(action.key);
        if (revisit >= 0) focusHistory = state.focusHistory.slice(0, revisit);
        else focusHistory = state.focusKey ? [...state.focusHistory, state.focusKey] : state.focusHistory;
      }
      return { ...state, viewMode: 'spotlight', focusKey: action.key, focusHistory, selectedKey: action.key, selectedEdge: null };
    }
    case 'spotlightBack': {
      if (state.focusHistory.length === 0) return { ...state, viewMode: 'overview' };
      const prev = state.focusHistory[state.focusHistory.length - 1];
      return { ...state, focusKey: prev, focusHistory: state.focusHistory.slice(0, -1), selectedKey: prev };
    }
    case 'setGroupDepth': return { ...state, groupDepth: action.depth };
    case 'toggleCollapsed': return { ...state, collapsed: toggle(state.collapsed, action.key) };
    case 'toggleType': return { ...state, hiddenTypes: toggle(state.hiddenTypes, action.kind) };
    case 'toggleStatus': return { ...state, hiddenStatuses: toggle(state.hiddenStatuses, action.status) };
    case 'toggleProject': return { ...state, hiddenProjects: toggle(state.hiddenProjects, action.key) };
    case 'toggleAssignee': return { ...state, hiddenAssignees: toggle(state.hiddenAssignees, action.name) };
    case 'toggleRelation': return { ...state, hiddenRelations: toggle(state.hiddenRelations, action.relation) };
    case 'setLinkLevel': return { ...state, linkLevel: action.level };
    case 'toggleLabel': return { ...state, hiddenLabels: toggle(state.hiddenLabels, action.label) };
    case 'toggleComponent': return { ...state, hiddenComponents: toggle(state.hiddenComponents, action.name) };
    case 'setDoneDisplay': return { ...state, doneDisplay: action.mode };
    case 'clearFilters': return {
      ...state,
      hiddenTypes: new Set(), hiddenStatuses: new Set(), hiddenProjects: new Set(),
      hiddenAssignees: new Set(), hiddenLabels: new Set(), hiddenComponents: new Set(),
      hiddenRelations: new Set(),
    };
    case 'revealInOverview': {
      // Jump to Overview, zoomed on the ticket — adjusting whatever currently
      // hides it: too-shallow Show depth, collapsed ancestors, or any filter
      // toggled against it. Settings are only ever LOOSENED, never tightened.
      const { node, minDepth, ancestors } = action;
      const without = <T,>(set: Set<T>, v: T): Set<T> => {
        if (!set.has(v)) return set;
        const next = new Set(set); next.delete(v); return next;
      };
      let collapsed = state.collapsed;
      for (const a of ancestors) collapsed = without(collapsed, a);
      // Multi-valued filters hide a ticket only when ALL its tags are off —
      // re-enabling the first tag is enough to bring it back.
      const labels = node.labels ?? [];
      const hiddenLabels = labels.length > 0 && labels.every((l) => state.hiddenLabels.has(l))
        ? without(state.hiddenLabels, labels[0]) : state.hiddenLabels;
      const components = node.components ?? [];
      const hiddenComponents = components.length > 0 && components.every((c) => state.hiddenComponents.has(c))
        ? without(state.hiddenComponents, components[0]) : state.hiddenComponents;
      return {
        ...state,
        viewMode: 'overview',
        groupDepth: Math.max(state.groupDepth, minDepth) as GroupDepth,
        collapsed,
        hiddenTypes: without(state.hiddenTypes, node.type.kind),
        hiddenStatuses: without(state.hiddenStatuses, node.status.category),
        hiddenProjects: without(state.hiddenProjects, node.project.key),
        hiddenAssignees: without(state.hiddenAssignees, node.assignee?.displayName ?? '__unassigned__'),
        hiddenLabels, hiddenComponents,
        doneDisplay: state.doneDisplay === 'hide' && node.status.category === 'done' ? 'dim' : state.doneDisplay,
        focusKey: node.key, focusHistory: [],
        selectedKey: node.key, selectedEdge: null,
        reveal: { key: node.key, n: (state.reveal?.n ?? 0) + 1 },
      };
    }
    case 'setSearch': return { ...state, search: action.query };
    case 'select': return { ...state, selectedKey: action.key, selectedEdge: null };
    case 'selectEdge': return { ...state, selectedEdge: { id: action.id, x: action.x, y: action.y, srcKey: action.srcKey, tgtKey: action.tgtKey, relation: action.relation, label: action.label }, selectedKey: null };
    case 'clearEdge': return { ...state, selectedEdge: null };
    default: return state;
  }
}
