import type { Edge, Node } from '@xyflow/react';
import type { Graph } from '../core/model';
import type { GraphState } from '../state/graphReducer';
import type { Positions } from './layouts/types';
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
      data: { node: gn, selected: state.selectedKey === gn.key, search: state.search },
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
      style: { stroke: colorVar, strokeWidth: 1.6, strokeDasharray: ge.directed ? undefined : '5 4' },
      markerEnd: ge.directed ? ({ type: 'arrowclosed', color: colorVar } as Edge['markerEnd']) : undefined,
    });
  }
  return { nodes, edges };
}
