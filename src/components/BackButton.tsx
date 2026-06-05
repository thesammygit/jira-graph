import type { Dispatch } from 'react';
import type { Action, GraphState } from '../state/graphReducer';

export function BackButton({ state, dispatch }: { state: GraphState; dispatch: Dispatch<Action> }) {
  if (state.mode !== 'focus') return null;
  return (
    <button className="back-btn" onClick={() => dispatch({ type: 'setMode', mode: 'map' })}>
      ← Back to all{state.focusKey ? ` · ${state.focusKey}` : ''}
    </button>
  );
}
