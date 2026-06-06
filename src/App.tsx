import { useEffect, useMemo, useReducer, useState } from 'react';
import type { Graph } from './core/model';
import { MockProvider } from './providers/MockProvider';
import { v3Issues, v3Caps } from './fixtures/v3';
import { v2Issues, v2Caps } from './fixtures/v2';
import { largeIssues, largeCaps } from './fixtures/large';
import { hugeIssues, hugeCaps } from './fixtures/huge';
import { initialState, reducer } from './state/graphReducer';
import { GroupedCanvas } from './components/GroupedCanvas';
import { SpotlightView } from './components/SpotlightView';
import { TreeDetailView } from './components/TreeDetailView';
import { Sidebar } from './components/Sidebar';
import { EdgePopup } from './components/EdgePopup';
import { useTheme } from './theme/useTheme';
import './App.css';

type Dataset = 'v3' | 'v2' | 'v2-no-epic' | 'large' | 'huge';

function providerFor(ds: Dataset): MockProvider {
  if (ds === 'v3') return new MockProvider(v3Issues, v3Caps);
  if (ds === 'v2') return new MockProvider(v2Issues, v2Caps);
  if (ds === 'large') return new MockProvider(largeIssues, largeCaps);
  if (ds === 'huge') return new MockProvider(hugeIssues, hugeCaps);
  return new MockProvider(v2Issues, { ...v2Caps, hasEpicLink: false }); // graceful degradation demo
}

export default function App() {
  const [dataset, setDataset] = useState<Dataset>('large');
  const [state, dispatch] = useReducer(reducer, initialState);
  const [full, setFull] = useState<Graph>({ nodes: [], edges: [] });
  const [view, setView] = useState<Graph>({ nodes: [], edges: [] });
  const provider = useMemo(() => providerFor(dataset), [dataset]);
  const { theme, toggle } = useTheme();

  useEffect(() => { provider.getGraph().then(setFull); }, [provider]);
  useEffect(() => { setView(full); }, [full]);

  return (
    <div className="app">
      <Sidebar graph={full} state={state} dispatch={dispatch}
        theme={theme} onToggleTheme={toggle} dataset={dataset} onDataset={setDataset} />
      <main className={`app-main done-${state.doneDisplay}`}>
        {state.viewMode === 'spotlight'
          ? <SpotlightView graph={full} state={state} dispatch={dispatch} />
          : state.viewMode === 'tree'
          ? <TreeDetailView graph={full} state={state} dispatch={dispatch} />
          : <GroupedCanvas graph={view} state={state} dispatch={dispatch}
              onNodeOpen={(id) => dispatch({ type: 'openSpotlight', key: id })}
              onEdgeClick={(p) => dispatch({ type: 'selectEdge', ...p })} />}
        <EdgePopup graph={view} state={state} dispatch={dispatch} />
      </main>
    </div>
  );
}
