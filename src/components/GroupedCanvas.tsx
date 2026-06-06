import { useCallback, useMemo, useRef, useState } from 'react';
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, useReactFlow, type Node, type NodeTypes, type EdgeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEffect } from 'react';
import type { Dispatch } from 'react';
import type { Graph } from '../core/model';
import type { Action, GraphState } from '../state/graphReducer';
import { groupGraph } from '../graph/grouping';
import { GROUP, layoutGrouped } from '../graph/layouts/grouped';
import { filterGroupingForState, toGroupedElements } from '../graph/grouped-elements';
import { computeEdgePaths } from '../graph/edge-paths';
import { TicketNode } from './TicketNode';
import { ContainerNode } from './ContainerNode';
import { MoreChipNode } from './MoreChipNode';
import { RoutedEdge } from './RoutedEdge';
import { RoutingContext } from './routing-context';
import { LodContext } from './lod-context';

// Module scope (stable identity, present on first paint) so React Flow doesn't log
// "type not found" during the initial render race.
const nodeTypes = { ticket: TicketNode, container: ContainerNode, moreChip: MoreChipNode } as unknown as NodeTypes;
const edgeTypes = { routed: RoutedEdge } as unknown as EdgeTypes;

export interface EdgeClickPayload { id: string; x: number; y: number; srcKey: string; tgtKey: string; relation: string; label: string }
function Canvas({ graph, state, dispatch, onEdgeClick, onNodeOpen }: { graph: Graph; state: GraphState; dispatch: Dispatch<Action>; onEdgeClick?: (p: EdgeClickPayload) => void; onNodeOpen?: (id: string) => void }) {
  const { nodes, edges } = useMemo(() => {
    const grouping = filterGroupingForState(groupGraph(graph, state.groupDepth), state);
    const { nodes, edges } = toGroupedElements(graph, grouping, layoutGrouped(grouping), state);
    // inject the collapse/expand handlers into container + more-chip node data
    const wired = nodes.map((n) => n.type === 'container'
      ? { ...n, data: { ...n.data, onToggle: (k: string) => dispatch({ type: 'toggleCollapsed', key: k }), onOpen: (k: string) => onNodeOpen?.(k) } }
      : n.type === 'moreChip'
      ? { ...n, data: { ...n.data, onExpand: (k: string, mode: 'more' | 'filtered') => dispatch(mode === 'filtered' ? { type: 'clearFilters' } : { type: 'expandBox', key: k }) } }
      : n);
    return { nodes: wired, edges };
  }, [graph, state.groupDepth, state.collapsed, state.onlyTypes, state.hiddenStatuses, state.onlyProjects, state.onlyAssignees, state.hiddenRelations, state.linkLevel, state.onlyLabels, state.onlyComponents, state.hideUngrouped, state.doneDisplay, state.selectedKey, state.search, state.focusKey, state.expandedBoxes, dispatch, onNodeOpen]);

  const { fitView } = useReactFlow();
  useEffect(() => {
    const id = requestAnimationFrame(() => fitView({ duration: 300, padding: 0.15 }));
    return () => cancelAnimationFrame(id);
  }, [graph, state.groupDepth, nodes.length, edges.length, fitView]);

  // Reveal request (search Enter / "Show in Overview"): zoom to the ticket and
  // center it. Declared AFTER the general fit effect so its fitView call runs
  // last in the same frame and wins the race when both fire together. Keyed on
  // the reveal object (not `nodes`) so unrelated re-renders don't re-zoom.
  const revealReady = !!state.reveal && nodes.some((n) => n.id === state.reveal!.key);
  useEffect(() => {
    if (!state.reveal || !revealReady) return;
    const key = state.reveal.key;
    const id = requestAnimationFrame(() => requestAnimationFrame(() =>
      fitView({ nodes: [{ id: key }], duration: 400, padding: 0.4, maxZoom: 1.2 })));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.reveal, revealReady, fitView]);

  // Full absolute rects for every node (containers = the whole box) plus the
  // ancestry maps the gutter router needs. Cross-box wires then travel ONLY in
  // the whitespace between top-level boxes — never through a container. All
  // edge paths are routed in ONE sequential pass (shared usage map + lane
  // fan-out) so wires never render on top of each other. Small boards route
  // synchronously (paths present on first paint); big ones hand the same pure
  // computation to a Web Worker and the wires appear when it answers.
  const SYNC_EDGE_LIMIT = 150;
  const geometry = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const absOf = (n: any): { x: number; y: number } => {
      let x = n.position.x, y = n.position.y, p = n.parentId ? byId.get(n.parentId) : undefined;
      while (p) { x += p.position.x; y += p.position.y; p = p.parentId ? byId.get(p.parentId) : undefined; }
      return { x, y };
    };
    const obstacles = nodes.map((n) => {
      const p = absOf(n);
      const w = n.type === 'container' ? ((n.data as any).width ?? 200) : GROUP.CHIP_W;
      const h = n.type === 'container' ? ((n.data as any).height ?? 80) : GROUP.CHIP_H;
      return { id: n.id, rect: { x: p.x, y: p.y, width: w, height: h } };
    });
    const topOf: Record<string, string> = {};
    const ancestorsOf: Record<string, string[]> = {};
    for (const n of nodes) {
      const chain: string[] = [];
      let p = n.parentId ? byId.get(n.parentId) : undefined;
      while (p) { chain.push(p.id); p = p.parentId ? byId.get(p.parentId) : undefined; }
      ancestorsOf[n.id] = chain;
      topOf[n.id] = chain.length ? chain[chain.length - 1] : n.id;
    }
    return { obstacles, topOf, ancestorsOf };
  }, [nodes]);

  const syncPaths = useMemo(
    () => (edges.length <= SYNC_EDGE_LIMIT ? computeEdgePaths(edges, geometry) : null),
    [edges, geometry],
  );
  const [asyncPaths, setAsyncPaths] = useState<Record<string, string>>({});
  const workerRef = useRef<Worker | null>(null);
  const seqRef = useRef(0);
  useEffect(() => () => { workerRef.current?.terminate(); workerRef.current = null; }, []);
  useEffect(() => {
    if (syncPaths) return; // small board — routed inline already
    workerRef.current ??= new Worker(new URL('../graph/route.worker.ts', import.meta.url), { type: 'module' });
    const worker = workerRef.current;
    const seq = ++seqRef.current;
    const onMessage = (e: MessageEvent<{ seq: number; paths: Record<string, string> }>) => {
      if (e.data.seq === seq) setAsyncPaths(e.data.paths); // ignore stale answers
    };
    worker.addEventListener('message', onMessage);
    worker.postMessage({ seq, edges, info: geometry });
    return () => worker.removeEventListener('message', onMessage);
  }, [syncPaths, edges, geometry]);

  const routingInfo = useMemo(
    () => ({ ...geometry, paths: syncPaths ?? asyncPaths }),
    [geometry, syncPaths, asyncPaths],
  );

  // Far-zoom flag for cheap LOD ticket cards — state flips only across the
  // threshold, not on every pan/zoom frame. Only kicks in on big boards;
  // small ones render full cards at any zoom (their DOM cost is trivial).
  const [farOut, setFarOut] = useState(false);
  const onMove = useCallback((_e: unknown, vp: { zoom: number }) => {
    const next = vp.zoom < 0.35;
    setFarOut((prev) => (prev === next ? prev : next));
  }, []);
  const lod = farOut && nodes.length > 300;

  return (
    <RoutingContext.Provider value={routingInfo}>
    <LodContext.Provider value={lod}>
      {/* minZoom lets fitView zoom out far enough to show the whole project */}
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView
        minZoom={0.08}
        onlyRenderVisibleElements
        onMove={onMove}
        nodesConnectable={false}
        nodesDraggable={false}
        onNodeClick={(_e, n: Node) => { if (n.type === 'ticket') onNodeOpen?.(n.id); }}
        onEdgeClick={(e, edge) => onEdgeClick?.({ id: edge.id, x: e.clientX, y: e.clientY, srcKey: (edge.data as any)?.srcKey ?? edge.source, tgtKey: (edge.data as any)?.tgtKey ?? edge.target, relation: (edge.data as any)?.rel ?? '', label: (edge.data as any)?.label ?? '' })}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'var(--bg)' }}>
        <Background color="var(--bg-grid)" />
        <Controls />
        <MiniMap pannable zoomable style={{ background: 'var(--surface)' }}
          nodeColor={(n) => n.type === 'container' ? 'color-mix(in srgb, var(--accent) 14%, var(--surface))' : 'var(--ink-muted)'}
          nodeStrokeColor={'var(--border-strong)'}
          maskColor={'color-mix(in srgb, var(--bg) 55%, transparent)'} />
      </ReactFlow>
    </LodContext.Provider>
    </RoutingContext.Provider>
  );
}

export function GroupedCanvas(props: { graph: Graph; state: GraphState; dispatch: Dispatch<Action>; onEdgeClick?: (p: EdgeClickPayload) => void; onNodeOpen?: (id: string) => void }) {
  return <ReactFlowProvider><Canvas {...props} /></ReactFlowProvider>;
}
