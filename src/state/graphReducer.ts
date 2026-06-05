import type { IssueKind, StatusCategory } from '../core/model';
import type { LayoutKind } from '../graph/layouts';

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
}

export const initialState: GraphState = {
  mode: 'map', focusKey: null, depth: 2, layout: 'hybrid',
  hiddenTypes: new Set(), hiddenStatuses: new Set(), hiddenRelations: new Set(),
  search: '', selectedKey: null,
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
  | { type: 'select'; key: string | null };

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
}

export function reducer(state: GraphState, action: Action): GraphState {
  switch (action.type) {
    case 'setMode': return { ...state, mode: action.mode, focusKey: action.mode === 'map' ? null : state.focusKey };
    case 'setFocus': return { ...state, mode: 'focus', focusKey: action.key };
    case 'setDepth': return { ...state, depth: Math.max(0, action.depth) };
    case 'setLayout': return { ...state, layout: action.layout };
    case 'toggleType': return { ...state, hiddenTypes: toggle(state.hiddenTypes, action.kind) };
    case 'toggleStatus': return { ...state, hiddenStatuses: toggle(state.hiddenStatuses, action.status) };
    case 'toggleRelation': return { ...state, hiddenRelations: toggle(state.hiddenRelations, action.relation) };
    case 'setSearch': return { ...state, search: action.query };
    case 'select': return { ...state, selectedKey: action.key };
    default: return state;
  }
}
