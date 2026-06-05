import type { Edge, Node } from '@xyflow/react';
import type { Graph } from '../core/model';
import type { Grouping, GroupContainer } from './grouping';
import type { GroupedLayout } from './layouts/grouped';
import type { GraphState } from '../state/graphReducer';

const EDGE_COLOR: Record<string, string> = { blocks: '#e12d39', relates: '#2186eb' };

export function toGroupedElements(graph: Graph, grouping: Grouping, layout: GroupedLayout, state: GraphState): { nodes: Node[]; edges: Edge[] } {
  // Map each ticket to the container that owns it, and whether it is currently visible.
  const ownerContainer = new Map<string, string>();   // ticket key -> nearest container key
  const ancestorChain = new Map<string, string[]>();  // container key -> [self, parent, ...] container chain
  const visibleMembers = new Set<string>();
  const visibleContainers = new Set<string>();

  // Walk grouping to record ownership + ancestor chains.
  const walk = (c: GroupContainer, chain: string[]) => {
    const here = [c.key, ...chain];
    ancestorChain.set(c.key, here);
    for (const m of c.members) ownerContainer.set(m.key, c.key);
    for (const s of c.subContainers) walk(s, here);
  };
  grouping.containers.forEach((c) => walk(c, []));

  // A container is "hidden under collapse" if any ancestor (strictly above self) is collapsed.
  const isUnderCollapse = (containerKey: string): boolean => {
    const chain = ancestorChain.get(containerKey) ?? [containerKey];
    // chain[0] is self; an ancestor strictly above self being collapsed hides it
    return chain.slice(1).some((a) => state.collapsed.has(a));
  };

  const filteredOut = (kind: string, cat: string) => state.hiddenTypes.has(kind as any) || state.hiddenStatuses.has(cat as any);

  // Build nodes.
  const nodes: Node[] = [];
  const nodeByKey = new Map(graph.nodes.map((n) => [n.key, n]));
  for (const pc of layout.containers) {
    if (isUnderCollapse(pc.key)) continue; // a sub-container inside a collapsed ancestor is not shown
    visibleContainers.add(pc.key);
    const header = pc.key === '__ungrouped__' ? { key: '__ungrouped__', summary: 'Ungrouped' } : nodeByKey.get(pc.key);
    nodes.push({
      id: pc.key, type: 'container', position: { x: pc.x, y: pc.y },
      ...(pc.parentKey ? { parentId: pc.parentKey, extent: 'parent' as const } : {}),
      data: { node: header, depth: pc.depth, collapsed: state.collapsed.has(pc.key), width: pc.width, height: pc.height },
      style: { width: pc.width, height: pc.height },
    });
  }
  for (const pm of layout.members) {
    const ownerCollapsed = state.collapsed.has(pm.parentKey) || isUnderCollapse(pm.parentKey);
    if (ownerCollapsed) continue;
    const node = nodeByKey.get(pm.key); if (!node) continue;
    if (filteredOut(node.type.kind, node.status.category)) continue;
    visibleMembers.add(pm.key);
    nodes.push({
      id: pm.key, type: 'ticket', parentId: pm.parentKey, extent: 'parent',
      position: { x: pm.x, y: pm.y },
      data: { node, selected: state.selectedKey === pm.key, search: state.search },
    });
  }

  // Resolve an endpoint: if the member is visible, return its key.
  // Otherwise, climb the ownerContainer/ancestor chain to find the outermost
  // collapsed container that is itself visible (i.e., not hidden by a further ancestor collapse).
  const resolveEndpoint = (key: string): string | null => {
    if (visibleMembers.has(key)) return key;
    // Find the container that owns this member
    let container = ownerContainer.get(key);
    // Climb ancestor chain to find the outermost collapsed visible container
    let lastVisible: string | null = null;
    while (container) {
      if (visibleContainers.has(container)) {
        lastVisible = container;
      }
      const chain = ancestorChain.get(container) ?? [];
      container = chain[1]; // parent container
    }
    return lastVisible;
  };

  // Build edges: only link edges (hierarchy is implied by containment).
  const edges: Edge[] = [];
  const seen = new Set<string>();
  for (const ge of graph.edges) {
    if (ge.kind !== 'link') continue;
    const relKey = ge.relation;
    if (state.hiddenRelations.has(relKey)) continue;
    const s = resolveEndpoint(ge.source), t = resolveEndpoint(ge.target);
    if (!s || !t || s === t) continue;
    const id = `${s}->${t}:${relKey}`;
    if (seen.has(id)) continue; seen.add(id);
    const color = EDGE_COLOR[ge.relation] ?? '#7b8794';
    edges.push({
      id, source: s, target: t, label: ge.label, type: 'smoothstep',
      style: { stroke: color, strokeWidth: 1.6, strokeDasharray: ge.directed ? undefined : '5 4' },
      markerEnd: ge.directed ? ({ type: 'arrowclosed', color } as Edge['markerEnd']) : undefined,
    });
  }
  return { nodes, edges };
}
