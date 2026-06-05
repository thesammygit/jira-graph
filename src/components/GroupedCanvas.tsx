import { useMemo } from 'react';
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, useReactFlow, type Node, type NodeTypes } from '@xyflow/react';
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

function Canvas({ graph, state, dispatch, onSelect }: { graph: Graph; state: GraphState; dispatch: Dispatch<Action>; onSelect: (k: string) => void }) {
  const { nodes, edges } = useMemo(() => {
    const grouping = groupGraph(graph, state.groupDepth);
    const { nodes, edges } = toGroupedElements(graph, grouping, layoutGrouped(grouping), state);
    // inject the collapse handler into container node data
    const wired = nodes.map((n) => n.type === 'container'
      ? { ...n, data: { ...n.data, onToggle: (k: string) => dispatch({ type: 'toggleCollapsed', key: k }) } } : n);
    return { nodes: wired, edges };
  }, [graph, state.groupDepth, state.collapsed, state.hiddenTypes, state.hiddenStatuses, state.hiddenRelations, state.selectedKey, state.search, dispatch]);

  const nodeTypes = useMemo(() => ({ ticket: TicketNode, container: ContainerNode } as unknown as NodeTypes), []);
  const { fitView } = useReactFlow();
  useEffect(() => { const id = requestAnimationFrame(() => fitView({ duration: 300, padding: 0.15 })); return () => cancelAnimationFrame(id); }, [graph, state.groupDepth, fitView]);

  return (
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView
      onNodeClick={(_, n: Node) => n.type === 'ticket' && onSelect(n.id)} proOptions={{ hideAttribution: true }}
      style={{ background: 'var(--bg)' }}>
      <Background color="var(--bg-grid)" />
      <Controls />
      <MiniMap pannable zoomable style={{ background: 'var(--surface)' }} />
    </ReactFlow>
  );
}

export function GroupedCanvas(props: { graph: Graph; state: GraphState; dispatch: Dispatch<Action>; onSelect: (k: string) => void }) {
  return <ReactFlowProvider><Canvas {...props} /></ReactFlowProvider>;
}
