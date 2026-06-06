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
  /** Opt-in filters: EMPTY set = no filtering (show everything); selecting
   *  values narrows the board to matching tickets only. */
  onlyTypes: Set<IssueKind>;
  hiddenStatuses: Set<StatusCategory>;
  onlyProjects: Set<string>;
  onlyAssignees: Set<string>;
  hiddenRelations: Set<string>;
  linkLevel: LinkLevel;
  onlyLabels: Set<string>;
  onlyComponents: Set<string>;
  /** Hide the synthetic Ungrouped box (loose non-epic tickets). */
  hideUngrouped: boolean;
  doneDisplay: DoneDisplay;
  search: string;
  selectedKey: string | null;
  selectedEdge: { id: string; x: number; y: number; srcKey: string; tgtKey: string; relation: string; label: string } | null;
  /** Pending "zoom to this ticket in Overview" request; `n` bumps so repeat
   *  reveals of the same key still re-trigger the zoom effect. */
  reveal: { key: string; n: number } | null;
  /** Boxes the user opted into showing ALL members of (past the +N-more cap). */
  expandedBoxes: Set<string>;
}

export const initialState: GraphState = {
  viewMode: 'overview', focusKey: null, focusHistory: [],
  groupDepth: 4, collapsed: new Set(),
  onlyTypes: new Set(), hiddenStatuses: new Set(), onlyProjects: new Set(), onlyAssignees: new Set(), hiddenRelations: new Set(),
  linkLevel: 'all',
  onlyLabels: new Set(), onlyComponents: new Set(),
  hideUngrouped: false,
  doneDisplay: 'normal',
  search: '', selectedKey: null, selectedEdge: null, reveal: null,
  expandedBoxes: new Set(),
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
  | { type: 'datasetDefaults'; nodeCount: number }
  | { type: 'expandBox'; key: string }
  | { type: 'toggleUngrouped' }
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
    case 'toggleType': return { ...state, onlyTypes: toggle(state.onlyTypes, action.kind) };
    case 'toggleStatus': return { ...state, hiddenStatuses: toggle(state.hiddenStatuses, action.status) };
    case 'toggleProject': return { ...state, onlyProjects: toggle(state.onlyProjects, action.key) };
    case 'toggleAssignee': return { ...state, onlyAssignees: toggle(state.onlyAssignees, action.name) };
    case 'toggleRelation': return { ...state, hiddenRelations: toggle(state.hiddenRelations, action.relation) };
    case 'setLinkLevel': return { ...state, linkLevel: action.level };
    case 'toggleLabel': return { ...state, onlyLabels: toggle(state.onlyLabels, action.label) };
    case 'toggleComponent': return { ...state, onlyComponents: toggle(state.onlyComponents, action.name) };
    case 'setDoneDisplay': return { ...state, doneDisplay: action.mode };
    case 'clearFilters': return {
      ...state,
      onlyTypes: new Set(), hiddenStatuses: new Set(), onlyProjects: new Set(),
      onlyAssignees: new Set(), onlyLabels: new Set(), onlyComponents: new Set(),
      hiddenRelations: new Set(),
    };
    case 'toggleUngrouped': return { ...state, hideUngrouped: !state.hideUngrouped };
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
      // Opt-in filters: an active selection that excludes this ticket gets the
      // ticket's value ADDED (or cleared, when the ticket has no value to add).
      const widen = <T,>(set: Set<T>, v: T | undefined): Set<T> => {
        if (set.size === 0 || (v !== undefined && set.has(v))) return set;
        if (v === undefined) return new Set<T>(); // can't match — drop the filter
        const next = new Set(set); next.add(v); return next;
      };
      const labels = node.labels ?? [];
      const onlyLabels = state.onlyLabels.size > 0 && !labels.some((l) => state.onlyLabels.has(l))
        ? widen(state.onlyLabels, labels[0]) : state.onlyLabels;
      const components = node.components ?? [];
      const onlyComponents = state.onlyComponents.size > 0 && !components.some((c) => state.onlyComponents.has(c))
        ? widen(state.onlyComponents, components[0]) : state.onlyComponents;
      return {
        ...state,
        viewMode: 'overview',
        groupDepth: Math.max(state.groupDepth, minDepth) as GroupDepth,
        collapsed,
        onlyTypes: widen(state.onlyTypes, node.type.kind),
        hiddenStatuses: without(state.hiddenStatuses, node.status.category),
        onlyProjects: widen(state.onlyProjects, node.project.key),
        onlyAssignees: widen(state.onlyAssignees, node.assignee?.displayName ?? '__unassigned__'),
        onlyLabels, onlyComponents,
        doneDisplay: state.doneDisplay === 'hide' && node.status.category === 'done' ? 'dim' : state.doneDisplay,
        focusKey: node.key, focusHistory: [],
        selectedKey: node.key, selectedEdge: null,
        reveal: { key: node.key, n: (state.reveal?.n ?? 0) + 1 },
      };
    }
    case 'datasetDefaults': {
      // Scale-aware opening posture: big projects start at the epic level with
      // story-and-up links (progressive disclosure — drill in on demand);
      // small ones open fully expanded as before.
      const big = action.nodeCount > 400;
      return {
        ...state,
        groupDepth: big ? 1 : 4,
        linkLevel: big ? 'story' : 'all',
        collapsed: new Set<string>(),
        reveal: null,
        expandedBoxes: new Set<string>(),
        onlyTypes: new Set<IssueKind>(), onlyProjects: new Set<string>(),
        onlyAssignees: new Set<string>(), onlyLabels: new Set<string>(), onlyComponents: new Set<string>(),
        hideUngrouped: false,
      };
    }
    case 'expandBox': {
      const expandedBoxes = new Set(state.expandedBoxes);
      expandedBoxes.add(action.key);
      return { ...state, expandedBoxes };
    }
    case 'setSearch': return { ...state, search: action.query };
    case 'select': return { ...state, selectedKey: action.key, selectedEdge: null };
    case 'selectEdge': return { ...state, selectedEdge: { id: action.id, x: action.x, y: action.y, srcKey: action.srcKey, tgtKey: action.tgtKey, relation: action.relation, label: action.label }, selectedKey: null };
    case 'clearEdge': return { ...state, selectedEdge: null };
    default: return state;
  }
}
