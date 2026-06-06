import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Graph } from './core/model';
import type { DataProvider } from './providers/DataProvider';
import { MockProvider } from './providers/MockProvider';
import { LazyMockProvider } from './providers/LazyMockProvider';
import { v3Issues, v3Caps } from './fixtures/v3';
import { v2Issues, v2Caps } from './fixtures/v2';
import { largeIssues, largeCaps } from './fixtures/large';
import { hugeIssues, hugeCaps } from './fixtures/huge';
import { initialState, reducer } from './state/graphReducer';
import { mergeGraphs } from './graph/merge';
import { GroupedCanvas } from './components/GroupedCanvas';
import { SpotlightView } from './components/SpotlightView';
import { TreeDetailView } from './components/TreeDetailView';
import { Sidebar } from './components/Sidebar';
import { EdgePopup } from './components/EdgePopup';
import { useTheme } from './theme/useTheme';
import './App.css';

type Dataset = 'v3' | 'v2' | 'v2-no-epic' | 'large' | 'huge' | 'lazy';

function providerFor(ds: Dataset): DataProvider {
  if (ds === 'v3') return new MockProvider(v3Issues, v3Caps);
  if (ds === 'v2') return new MockProvider(v2Issues, v2Caps);
  if (ds === 'large') return new MockProvider(largeIssues, largeCaps);
  if (ds === 'huge') return new MockProvider(hugeIssues, hugeCaps);
  if (ds === 'lazy') return new LazyMockProvider(hugeIssues, hugeCaps);
  return new MockProvider(v2Issues, { ...v2Caps, hasEpicLink: false }); // graceful degradation demo
}

export default function App() {
  const [dataset, setDataset] = useState<Dataset>('large');
  const [state, dispatch] = useReducer(reducer, initialState);
  const [full, setFull] = useState<Graph>({ nodes: [], edges: [] });
  const [view, setView] = useState<Graph>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(false);
  const provider = useMemo(() => providerFor(dataset), [dataset]);
  const { theme, toggle } = useTheme();

  // Lazy-provider bookkeeping: how many hierarchy levels are loaded and the
  // deepest level's keys (the next fetch's parents).
  const lazyRef = useRef<{ levels: number; frontier: string[]; busy: boolean }>({ levels: 0, frontier: [], busy: false });

  useEffect(() => {
    let live = true;
    lazyRef.current = { levels: 0, frontier: [], busy: false };
    setLoading(true);
    const initial = provider.lazy && provider.getRoots ? provider.getRoots() : provider.getGraph();
    initial.then((g) => {
      if (!live) return;
      setFull(g);
      setLoading(false);
      lazyRef.current = { levels: 1, frontier: g.nodes.map((n) => n.key), busy: false };
      dispatch({ type: 'datasetDefaults', nodeCount: provider.sizeHint ?? g.nodes.length });
    });
    return () => { live = false; };
  }, [provider]);

  // Lazy providers: pull deeper levels only when the Show depth asks for them.
  useEffect(() => {
    if (!provider.lazy || !provider.getChildren) return;
    const lazy = lazyRef.current;
    if (lazy.busy || lazy.levels === 0 || lazy.levels >= state.groupDepth || lazy.frontier.length === 0) return;
    lazy.busy = true;
    setLoading(true);
    provider.getChildren(lazy.frontier).then((chunk) => {
      lazy.levels += 1;
      lazy.frontier = chunk.nodes.map((n) => n.key);
      lazy.busy = false;
      setLoading(false);
      if (chunk.nodes.length) setFull((prev) => mergeGraphs(prev, chunk));
      else lazy.frontier = [];
    });
  }, [provider, state.groupDepth, full]);

  useEffect(() => { setView(full); }, [full]);

  return (
    <div className="app">
      <Sidebar graph={full} state={state} dispatch={dispatch}
        theme={theme} onToggleTheme={toggle} dataset={dataset} onDataset={setDataset} />
      <main className={`app-main done-${state.doneDisplay}`}>
        {loading && <div className="load-bar" role="progressbar" aria-label="Loading tickets" />}
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
