import type { Dispatch } from 'react';
import type { Action, GraphState } from '../state/graphReducer';
import type { Graph } from '../core/model';
const RELS = ['hierarchy', 'blocks', 'relates'];
export function Legend({ state, dispatch }: { graph: Graph; state: GraphState; dispatch: Dispatch<Action> }) {
  return (<div className="sb-chips">{RELS.map((r) => (
    <button key={r} className={`sb-chip ${state.hiddenRelations.has(r) ? '' : 'on'}`} onClick={() => dispatch({ type: 'toggleRelation', relation: r })}>{r}</button>
  ))}</div>);
}
