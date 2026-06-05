import type { Dispatch } from 'react';
import type { Action, GraphState } from '../state/graphReducer';
import type { Graph } from '../core/model';
import { legendEntries } from '../graph/relation-colors';

export function Legend({ graph, state, dispatch }: { graph: Graph; state: GraphState; dispatch: Dispatch<Action> }) {
  const entries = legendEntries(graph);
  return (
    <div className="legend">
      {entries.map((e) => (
        <button key={e.key} className={`legend-row ${state.hiddenRelations.has(e.key) ? 'off' : ''}`}
          onClick={() => dispatch({ type: 'toggleRelation', relation: e.key })} title="Toggle">
          <span className="legend-swatch" style={{ background: e.colorVar }} />{e.label}
        </button>
      ))}
    </div>
  );
}
