import { useEffect, useMemo } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, useReactFlow,
  type Node, type NodeTypes, type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Graph } from '../core/model';
import type { GraphState } from '../state/graphReducer';
import { layouts } from '../graph/layouts';
import { toFlowElements } from '../graph/flow-elements';
import { TicketNode } from './TicketNode';
import { RoutedEdge } from './RoutedEdge';
import { RoutingContext } from './routing-context';

// TicketNode has a typed `data` prop narrower than React Flow's `Record<string, unknown>`.
// Cast via `unknown` so tsc accepts it in nodeTypes without weakening TicketNode's prop type.
const nodeTypes = { ticket: TicketNode } as unknown as NodeTypes;
// Defined at module scope (stable identity, available on first paint) so React Flow
// never logs "edge type 'routed' not found" during the initial render race.
const edgeTypes = { routed: RoutedEdge } as unknown as EdgeTypes;

interface CanvasProps { graph: Graph; state: GraphState; onSelect: (key: string) => void; onEdgeClick?: (id: string, x: number, y: number) => void }

function Canvas({ graph, state, onSelect, onEdgeClick }: CanvasProps) {
  const { nodes, edges } = useMemo(() => {
    const positions = layouts[state.layout](graph);
    return toFlowElements(graph, positions, state);
  }, [graph, state.layout, state.hiddenTypes, state.hiddenStatuses, state.hiddenRelations, state.selectedKey, state.search]);

  // React Flow only auto-fits on mount. Re-center the camera whenever the layout
  // or the underlying graph (dataset / focus / depth) changes, so switching
  // layouts never strands the nodes off-screen. Filter/search changes are left
  // alone so they don't disrupt the user's manual zoom.
  const { fitView } = useReactFlow();
  useEffect(() => {
    const id = requestAnimationFrame(() => fitView({ duration: 300, padding: 0.2 }));
    return () => cancelAnimationFrame(id);
  }, [state.layout, graph, fitView]);

  const obstacles = useMemo(
    () => nodes.map((n) => ({ id: n.id, rect: { x: n.position.x, y: n.position.y, width: 210, height: 96 } })),
    [nodes],
  );

  return (
    <RoutingContext.Provider value={obstacles}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        onNodeClick={(_, n: Node) => onSelect(n.id)}
        onEdgeClick={(e, edge) => onEdgeClick?.(edge.id, e.clientX, e.clientY)}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'var(--bg)' }}
      >
        <Background color="var(--bg-grid)" />
        <Controls />
        <MiniMap pannable zoomable style={{ background: 'var(--surface)' }} />
      </ReactFlow>
    </RoutingContext.Provider>
  );
}

export function GraphCanvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
