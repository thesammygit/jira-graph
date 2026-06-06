import type { IssueKind, StatusCategory } from '../core/model';

export type ViewMode = 'overview' | 'spotlight';
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
  search: string;
  selectedKey: string | null;
  selectedEdge: { id: string; x: number; y: number; srcKey: string; tgtKey: string; relation: string; label: string } | null;
}

export const initialState: GraphState = {
  viewMode: 'overview', focusKey: null, focusHistory: [],
  groupDepth: 4, collapsed: new Set(),
  hiddenTypes: new Set(), hiddenStatuses: new Set(), hiddenProjects: new Set(), hiddenAssignees: new Set(), hiddenRelations: new Set(),
  linkLevel: 'all',
  search: '', selectedKey: null, selectedEdge: null,
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
      const pushPrev = state.viewMode === 'spotlight' && !!state.focusKey && state.focusKey !== action.key;
      const focusHistory = pushPrev ? [...state.focusHistory, state.focusKey!] : state.focusHistory;
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
    case 'setSearch': return { ...state, search: action.query };
    case 'select': return { ...state, selectedKey: action.key, selectedEdge: null };
    case 'selectEdge': return { ...state, selectedEdge: { id: action.id, x: action.x, y: action.y, srcKey: action.srcKey, tgtKey: action.tgtKey, relation: action.relation, label: action.label }, selectedKey: null };
    case 'clearEdge': return { ...state, selectedEdge: null };
    default: return state;
  }
}
