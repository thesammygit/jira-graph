import { useEffect, useMemo, useReducer, useState } from 'react';
import type { Graph } from './core/model';
import { MockProvider } from './providers/MockProvider';
import { v3Issues, v3Caps } from './fixtures/v3';
import { v2Issues, v2Caps } from './fixtures/v2';
import { initialState, reducer } from './state/graphReducer';
import { GraphCanvas } from './components/GraphCanvas';
import { GroupedCanvas } from './components/GroupedCanvas';
import { Toolbar } from './components/Toolbar';
import { DetailPanel } from './components/DetailPanel';
import './App.css';

type Dataset = 'v3' | 'v2' | 'v2-no-epic';

function providerFor(ds: Dataset): MockProvider {
  if (ds === 'v3') return new MockProvider(v3Issues, v3Caps);
  if (ds === 'v2') return new MockProvider(v2Issues, v2Caps);
  return new MockProvider(v2Issues, { ...v2Caps, hasEpicLink: false }); // graceful degradation demo
}

export default function App() {
  const [dataset, setDataset] = useState<Dataset>('v3');
  const [state, dispatch] = useReducer(reducer, initialState);
  const [full, setFull] = useState<Graph>({ nodes: [], edges: [] });
  const [view, setView] = useState<Graph>({ nodes: [], edges: [] });
  const provider = useMemo(() => providerFor(dataset), [dataset]);

  useEffect(() => { provider.getGraph().then(setFull); }, [provider]);
  useEffect(() => {
    if (state.mode === 'focus' && state.focusKey) provider.getNeighborhood(state.focusKey, state.depth).then(setView);
    else setView(full);
  }, [provider, full, state.mode, state.focusKey, state.depth]);

  return (
    <div className="app">
      <header className="app-bar">
        <strong>Jira Graph</strong>
        <select value={dataset} onChange={(e) => setDataset(e.target.value as Dataset)}>
          <option value="v3">Cloud v3 (parent field)</option>
          <option value="v2">Server v2 (Epic Link)</option>
          <option value="v2-no-epic">v2 — Epic Link absent</option>
        </select>
      </header>
      <Toolbar state={state} dispatch={dispatch} />
      <div className="app-canvas">
        {state.viewMode === 'grouped'
          ? <GroupedCanvas graph={view} state={state} dispatch={dispatch} onSelect={(key) => dispatch({ type: 'select', key })} />
          : <GraphCanvas graph={view} state={state} onSelect={(key) => dispatch({ type: 'select', key })} />}
        <DetailPanel graph={view} selectedKey={state.selectedKey} dispatch={dispatch} />
      </div>
    </div>
  );
}
