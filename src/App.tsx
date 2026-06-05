import { useEffect, useMemo, useReducer, useState } from 'react';
import type { Graph } from './core/model';
import { MockProvider } from './providers/MockProvider';
import { v3Issues, v3Caps } from './fixtures/v3';
import { v2Issues, v2Caps } from './fixtures/v2';
import { initialState, reducer } from './state/graphReducer';
import { GraphCanvas } from './components/GraphCanvas';
import { GroupedCanvas } from './components/GroupedCanvas';
import { TreeView } from './components/TreeView';
import { TimelineView } from './components/TimelineView';
import { Sidebar } from './components/Sidebar';
import { DetailPanel } from './components/DetailPanel';
import { useTheme } from './theme/useTheme';
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
  const { theme, toggle } = useTheme();

  useEffect(() => { provider.getGraph().then(setFull); }, [provider]);
  useEffect(() => {
    if (state.mode === 'focus' && state.focusKey) provider.getNeighborhood(state.focusKey, state.depth).then(setView);
    else setView(full);
  }, [provider, full, state.mode, state.focusKey, state.depth]);

  return (
    <div className="app">
      <Sidebar graph={view} state={state} dispatch={dispatch}
        theme={theme} onToggleTheme={toggle} dataset={dataset} onDataset={setDataset} />
      <main className="app-main">
        {state.viewMode === 'grouped' ? <GroupedCanvas graph={view} state={state} dispatch={dispatch} onSelect={(key) => dispatch({ type: 'select', key })} />
         : state.viewMode === 'tree' ? <TreeView graph={view} state={state} dispatch={dispatch} onSelect={(key) => dispatch({ type: 'select', key })} />
         : state.viewMode === 'timeline' ? <TimelineView graph={view} state={state} onSelect={(key) => dispatch({ type: 'select', key })} />
         : <GraphCanvas graph={view} state={state} onSelect={(key) => dispatch({ type: 'select', key })} />}
        <DetailPanel graph={view} selectedKey={state.selectedKey} dispatch={dispatch} />
      </main>
    </div>
  );
}
