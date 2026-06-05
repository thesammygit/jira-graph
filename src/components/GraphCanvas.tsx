import { useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap, type Node, type NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Graph } from '../core/model';
import type { GraphState } from '../state/graphReducer';
import { layouts } from '../graph/layouts';
import { toFlowElements } from '../graph/flow-elements';
import { TicketNode } from './TicketNode';

// TicketNode has a typed `data` prop narrower than React Flow's `Record<string, unknown>`.
// Cast via `unknown` so tsc accepts it in nodeTypes without weakening TicketNode's prop type.
const nodeTypes = { ticket: TicketNode } as unknown as NodeTypes;

export function GraphCanvas({ graph, state, onSelect }: { graph: Graph; state: GraphState; onSelect: (key: string) => void }) {
  const { nodes, edges } = useMemo(() => {
    const positions = layouts[state.layout](graph);
    return toFlowElements(graph, positions, state);
  }, [graph, state.layout, state.hiddenTypes, state.hiddenStatuses, state.hiddenRelations, state.selectedKey, state.search]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      onNodeClick={(_, n: Node) => onSelect(n.id)}
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <Controls />
      <MiniMap pannable zoomable />
    </ReactFlow>
  );
}
