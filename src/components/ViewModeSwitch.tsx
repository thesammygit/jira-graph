import type { Dispatch } from 'react';
import type { Action, GraphState, ViewMode, GroupDepth } from '../state/graphReducer';

const MODES: ViewMode[] = ['graph', 'grouped', 'tree', 'timeline'];
const DEPTHS: GroupDepth[] = [1, 2, 3];
const DEPTH_LABEL: Record<GroupDepth, string> = { 1: 'Epic', 2: 'Epic▸Story', 3: '▸Task' };

export function ViewModeSwitch({ state, dispatch }: { state: GraphState; dispatch: Dispatch<Action> }) {
  return (
    <div className="tb-group">
      <span className="tb-label">View</span>
      {MODES.map((m) => (
        <button key={m} className={state.viewMode === m ? 'on' : ''} onClick={() => dispatch({ type: 'setViewMode', viewMode: m })}>{m}</button>
      ))}
      {state.viewMode === 'grouped' && (
        <>
          <span className="tb-label" style={{ marginLeft: 8 }}>Depth</span>
          {DEPTHS.map((d) => (
            <button key={d} className={state.groupDepth === d ? 'on' : ''} onClick={() => dispatch({ type: 'setGroupDepth', depth: d })}>{DEPTH_LABEL[d]}</button>
          ))}
        </>
      )}
    </div>
  );
}
