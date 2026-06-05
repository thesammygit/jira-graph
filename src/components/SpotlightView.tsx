import type { Dispatch } from 'react';
import type { Graph } from '../core/model';
import type { Action, GraphState } from '../state/graphReducer';
import { spotlightModel } from '../graph/spotlight';

export function SpotlightView({ graph, state, dispatch }: { graph: Graph; state: GraphState; dispatch: Dispatch<Action> }) {
  const model = state.focusKey ? spotlightModel(graph, state.focusKey) : null;
  if (!model) return <div style={{ padding: 24, color: 'var(--ink-muted)' }}>Click a ticket in Overview to spotlight it.</div>;
  return (
    <div style={{ padding: 24, color: 'var(--ink)' }}>
      <button onClick={() => dispatch({ type: 'spotlightBack' })}>← Back</button>
      <h2>{model.hero.key} · {model.hero.summary}</h2>
    </div>
  );
}
