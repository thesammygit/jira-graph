import type { IssueKind, StatusCategory } from '../core/model';
import type { LayoutKind } from '../graph/layouts';

export type ViewMode = 'graph' | 'grouped' | 'tree' | 'timeline';
export type GroupDepth = 1 | 2 | 3 | 4;

export interface GraphState {
  mode: 'map' | 'focus';
  focusKey: string | null;
  depth: number;
  layout: LayoutKind;
  hiddenTypes: Set<IssueKind>;
  hiddenStatuses: Set<StatusCategory>;
  hiddenRelations: Set<string>;
  search: string;
  selectedKey: string | null;
  selectedEdge: { id: string; x: number; y: number; srcKey: string; tgtKey: string; relation: string; label: string } | null;
  viewMode: ViewMode;
  groupDepth: GroupDepth;
  collapsed: Set<string>;
  hiddenProjects: Set<string>;
  hiddenAssignees: Set<string>;
  nodePopup: { key: string; x: number; y: number } | null;
}

export const initialState: GraphState = {
  mode: 'map', focusKey: null, depth: 2, layout: 'hybrid',
  hiddenTypes: new Set(), hiddenStatuses: new Set(), hiddenRelations: new Set(),
  search: '', selectedKey: null, selectedEdge: null,
  viewMode: 'graph',
  groupDepth: 4,
  collapsed: new Set(),
  hiddenProjects: new Set(),
  hiddenAssignees: new Set(),
  nodePopup: null,
};

export type Action =
  | { type: 'setMode'; mode: 'map' | 'focus' }
  | { type: 'setFocus'; key: string }
  | { type: 'setDepth'; depth: number }
  | { type: 'setLayout'; layout: LayoutKind }
  | { type: 'toggleType'; kind: IssueKind }
  | { type: 'toggleStatus'; status: StatusCategory }
  | { type: 'toggleRelation'; relation: string }
  | { type: 'setSearch'; query: string }
  | { type: 'select'; key: string | null }
  | { type: 'selectEdge'; id: string; x: number; y: number; srcKey: string; tgtKey: string; relation: string; label: string }
  | { type: 'clearEdge' }
  | { type: 'setViewMode'; viewMode: ViewMode }
  | { type: 'setGroupDepth'; depth: GroupDepth }
  | { type: 'toggleCollapsed'; key: string }
  | { type: 'toggleProject'; key: string }
  | { type: 'toggleAssignee'; name: string }
  | { type: 'openNode'; key: string; x: number; y: number }
  | { type: 'closeNode' };

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
}

export function reducer(state: GraphState, action: Action): GraphState {
  switch (action.type) {
    case 'setMode': return { ...state, mode: action.mode, focusKey: action.mode === 'map' ? null : state.focusKey };
    case 'setFocus': return { ...state, mode: 'focus', focusKey: action.key, nodePopup: null };
    case 'setDepth': return { ...state, depth: Math.max(0, action.depth) };
    case 'setLayout': return { ...state, layout: action.layout };
    case 'toggleType': return { ...state, hiddenTypes: toggle(state.hiddenTypes, action.kind) };
    case 'toggleStatus': return { ...state, hiddenStatuses: toggle(state.hiddenStatuses, action.status) };
    case 'toggleRelation': return { ...state, hiddenRelations: toggle(state.hiddenRelations, action.relation) };
    case 'setSearch': return { ...state, search: action.query };
    case 'select': return { ...state, selectedKey: action.key, selectedEdge: null, nodePopup: null };
    case 'selectEdge': return { ...state, selectedEdge: { id: action.id, x: action.x, y: action.y, srcKey: action.srcKey, tgtKey: action.tgtKey, relation: action.relation, label: action.label }, selectedKey: null, nodePopup: null };
    case 'clearEdge': return { ...state, selectedEdge: null };
    case 'setViewMode': return { ...state, viewMode: action.viewMode };
    case 'setGroupDepth': return { ...state, groupDepth: action.depth };
    case 'toggleCollapsed': return { ...state, collapsed: toggle(state.collapsed, action.key) };
    case 'toggleProject': return { ...state, hiddenProjects: toggle(state.hiddenProjects, action.key) };
    case 'toggleAssignee': return { ...state, hiddenAssignees: toggle(state.hiddenAssignees, action.name) };
    case 'openNode': return { ...state, nodePopup: { key: action.key, x: action.x, y: action.y }, selectedKey: action.key };
    case 'closeNode': return { ...state, nodePopup: null };
    default: return state;
  }
}
