import type { Dispatch } from 'react';
import type { Action, GraphState } from '../state/graphReducer';
import type { LayoutKind } from '../graph/layouts';
import type { IssueKind } from '../core/model';
import './panels.css';

const LAYOUTS: LayoutKind[] = ['hybrid', 'hierarchical', 'force'];
const TYPES: IssueKind[] = ['epic', 'story', 'task', 'subtask', 'bug'];
const RELATIONS = ['hierarchy', 'blocks', 'relates'];

export function Toolbar({ state, dispatch }: { state: GraphState; dispatch: Dispatch<Action> }) {
  return (
    <div className="toolbar">
      <input className="tb-search" placeholder="Search key or summary…" value={state.search}
        onChange={(e) => dispatch({ type: 'setSearch', query: e.target.value })} />

      <div className="tb-group">
        <span className="tb-label">Mode</span>
        <button className={state.mode === 'map' ? 'on' : ''} onClick={() => dispatch({ type: 'setMode', mode: 'map' })}>Map</button>
        <button className={state.mode === 'focus' ? 'on' : ''} onClick={() => state.selectedKey && dispatch({ type: 'setFocus', key: state.selectedKey })}>Focus</button>
      </div>

      {state.mode === 'focus' && (
        <div className="tb-group">
          <span className="tb-label">Depth {state.depth}</span>
          <input type="range" min={0} max={5} value={state.depth} onChange={(e) => dispatch({ type: 'setDepth', depth: Number(e.target.value) })} />
        </div>
      )}

      <div className="tb-group">
        <span className="tb-label">Layout</span>
        {LAYOUTS.map((l) => <button key={l} className={state.layout === l ? 'on' : ''} onClick={() => dispatch({ type: 'setLayout', layout: l })}>{l}</button>)}
      </div>

      <div className="tb-group">
        <span className="tb-label">Types</span>
        {TYPES.map((t) => <button key={t} className={state.hiddenTypes.has(t) ? '' : 'on'} onClick={() => dispatch({ type: 'toggleType', kind: t })}>{t}</button>)}
      </div>

      <div className="tb-group">
        <span className="tb-label">Edges</span>
        {RELATIONS.map((r) => <button key={r} className={state.hiddenRelations.has(r) ? '' : 'on'} onClick={() => dispatch({ type: 'toggleRelation', relation: r })}>{r}</button>)}
      </div>
    </div>
  );
}
