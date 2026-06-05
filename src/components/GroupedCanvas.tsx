import { useMemo } from 'react';
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, useReactFlow, type Node, type NodeTypes, type EdgeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEffect } from 'react';
import type { Dispatch } from 'react';
import type { Graph } from '../core/model';
import type { Action, GraphState } from '../state/graphReducer';
import { groupGraph } from '../graph/grouping';
import { layoutGrouped } from '../graph/layouts/grouped';
import { toGroupedElements } from '../graph/grouped-elements';
import { TicketNode } from './TicketNode';
import { ContainerNode } from './ContainerNode';
import { RoutedEdge } from './RoutedEdge';
import { RoutingContext } from './routing-context';

// Module scope (stable identity, present on first paint) so React Flow doesn't log
// "type not found" during the initial render race.
const nodeTypes = { ticket: TicketNode, container: ContainerNode } as unknown as NodeTypes;
const edgeTypes = { routed: RoutedEdge } as unknown as EdgeTypes;

function Canvas({ graph, state, dispatch, onSelect, onEdgeClick }: { graph: Graph; state: GraphState; dispatch: Dispatch<Action>; onSelect: (k: string) => void; onEdgeClick?: (id: string, x: number, y: number) => void }) {
  const { nodes, edges } = useMemo(() => {
    const grouping = groupGraph(graph, state.groupDepth);
    const { nodes, edges } = toGroupedElements(graph, grouping, layoutGrouped(grouping), state);
    // inject the collapse handler into container node data
    const wired = nodes.map((n) => n.type === 'container'
      ? { ...n, data: { ...n.data, onToggle: (k: string) => dispatch({ type: 'toggleCollapsed', key: k }) } } : n);
    return { nodes: wired, edges };
  }, [graph, state.groupDepth, state.collapsed, state.hiddenTypes, state.hiddenStatuses, state.hiddenRelations, state.selectedKey, state.search, dispatch]);

  const { fitView } = useReactFlow();
  useEffect(() => { const id = requestAnimationFrame(() => fitView({ duration: 300, padding: 0.15 })); return () => cancelAnimationFrame(id); }, [graph, state.groupDepth, fitView]);

  const obstacles = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const abs = (n: any): { x: number; y: number } =>
      n.parentId && byId.get(n.parentId)
        ? { x: byId.get(n.parentId)!.position.x + n.position.x, y: byId.get(n.parentId)!.position.y + n.position.y }
        : n.position;
    return nodes.map((n) => {
      const p = abs(n);
      const w = n.type === 'container' ? ((n.data as any).width ?? 200) : 168;
      const h = n.type === 'container' ? ((n.data as any).height ?? 80) : 88;
      return { id: n.id, rect: { x: p.x, y: p.y, width: w, height: h } };
    });
  }, [nodes]);

  return (
    <RoutingContext.Provider value={obstacles}>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView
        onNodeClick={(_, n: Node) => n.type === 'ticket' && onSelect(n.id)}
        onEdgeClick={(e, edge) => onEdgeClick?.(edge.id, e.clientX, e.clientY)}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'var(--bg)' }}>
        <Background color="var(--bg-grid)" />
        <Controls />
        <MiniMap pannable zoomable style={{ background: 'var(--surface)' }} />
      </ReactFlow>
    </RoutingContext.Provider>
  );
}

export function GroupedCanvas(props: { graph: Graph; state: GraphState; dispatch: Dispatch<Action>; onSelect: (k: string) => void; onEdgeClick?: (id: string, x: number, y: number) => void }) {
  return <ReactFlowProvider><Canvas {...props} /></ReactFlowProvider>;
}
