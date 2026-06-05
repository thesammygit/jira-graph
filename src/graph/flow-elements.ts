import type { Edge, Node } from '@xyflow/react';
import type { Graph } from '../core/model';
import type { GraphState } from '../state/graphReducer';
import type { Positions } from './layouts/types';
import { TICKET_NODE_HEIGHT, TICKET_NODE_WIDTH } from './node-dimensions';
import { relationStyle } from './relation-colors';
import { isNodeVisible } from './visible';

export function toFlowElements(graph: Graph, positions: Positions, state: GraphState): { nodes: Node[]; edges: Edge[] } {
  const visible = new Set<string>();
  const nodes: Node[] = [];
  for (const gn of graph.nodes) {
    if (!isNodeVisible(gn, state)) continue;
    visible.add(gn.key);
    nodes.push({
      id: gn.key,
      type: 'ticket',
      position: positions.get(gn.key) ?? { x: 0, y: 0 },
      data: { node: gn, selected: state.selectedKey === gn.key, search: state.search, focal: state.focusKey === gn.key },
      style: { width: TICKET_NODE_WIDTH, height: TICKET_NODE_HEIGHT },
    });
  }
  const edges: Edge[] = [];
  for (const ge of graph.edges) {
    const relKey = ge.kind === 'hierarchy' ? 'hierarchy' : ge.relation;
    if (state.hiddenRelations.has(relKey)) continue;
    if (!visible.has(ge.source) || !visible.has(ge.target)) continue;
    const colorVar = relationStyle(relKey).colorVar;
    edges.push({
      id: ge.id, source: ge.source, target: ge.target, label: ge.label,
      type: 'routed',
      animated: ge.relation === 'blocks',
      data: { rel: relKey, label: ge.label ?? '', srcKey: ge.source, tgtKey: ge.target },
      style: { stroke: colorVar, strokeWidth: 2.2, opacity: 0.94, strokeDasharray: ge.directed ? undefined : '6 5' },
      markerEnd: ge.directed ? ({ type: 'arrowclosed', color: colorVar, width: 16, height: 16 } as Edge['markerEnd']) : undefined,
      zIndex: 2,
    });
  }
  return { nodes, edges };
}
