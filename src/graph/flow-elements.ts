import type { Edge, Node } from '@xyflow/react';
import type { Graph } from '../core/model';
import type { GraphState } from '../state/graphReducer';
import type { Positions } from './layouts/types';

const EDGE_COLOR: Record<string, string> = { hierarchy: '#9aa5b1', blocks: '#e12d39', relates: '#2186eb' };

function edgeColor(relation: string, kind: string): string {
  if (kind === 'hierarchy') return EDGE_COLOR.hierarchy;
  return EDGE_COLOR[relation] ?? '#7b8794';
}

export function toFlowElements(graph: Graph, positions: Positions, state: GraphState): { nodes: Node[]; edges: Edge[] } {
  const visible = new Set<string>();
  const nodes: Node[] = [];
  for (const gn of graph.nodes) {
    if (state.hiddenTypes.has(gn.type.kind) || state.hiddenStatuses.has(gn.status.category)) continue;
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
    const color = edgeColor(ge.relation, ge.kind);
    edges.push({
      id: ge.id, source: ge.source, target: ge.target, label: ge.label,
      animated: ge.relation === 'blocks',
      style: { stroke: color, strokeWidth: 1.6, strokeDasharray: ge.directed ? undefined : '5 4' },
      markerEnd: ge.directed ? ({ type: 'arrowclosed', color } as Edge['markerEnd']) : undefined,
    });
  }
  return { nodes, edges };
}
