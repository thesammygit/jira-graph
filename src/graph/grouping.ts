import type { Graph, GraphNode } from '../core/model';

export interface GroupContainer {
  key: string;                   // heading ticket key, or '__ungrouped__'
  node: GraphNode | null;        // heading ticket (null for the synthetic Ungrouped bucket)
  subContainers: GroupContainer[];
  members: GraphNode[];          // leaf tickets shown as chips
}
export interface Grouping { containers: GroupContainer[] }

/**
 * depth = how many hierarchy LEVELS are shown (1 = just the root epics,
 * 2 = epics + their stories, 3 = + tasks, 4 = + subtasks). Tickets below the
 * cut are NOT flattened — they're hidden entirely; their links re-aggregate
 * to the nearest visible ancestor in grouped-elements.
 */
export function groupGraph(graph: Graph, depth: number): Grouping {
  const nodeMap = new Map(graph.nodes.map((n) => [n.key, n]));
  const childrenOf = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const e of graph.edges) {
    if (e.kind !== 'hierarchy') continue;
    const arr = childrenOf.get(e.source) ?? [];
    if (!childrenOf.has(e.source)) childrenOf.set(e.source, arr);
    arr.push(e.target);
    hasParent.add(e.target);
  }

  const build = (key: string, level: number): GroupContainer => {
    const node = nodeMap.get(key) ?? null;
    const subContainers: GroupContainer[] = [];
    const members: GraphNode[] = [];
    if (level + 1 < depth) { // children live one level down — past the cut they vanish
      for (const childKey of childrenOf.get(key) ?? []) {
        const childHasChildren = (childrenOf.get(childKey) ?? []).length > 0;
        if (childHasChildren && level + 2 < depth) {
          subContainers.push(build(childKey, level + 1)); // its own children are still shown
        } else {
          const cn = nodeMap.get(childKey);
          if (cn) members.push(cn); // leaf chip — grandchildren (if any) fall past the cut
        }
      }
    }
    return { key, node, subContainers, members };
  };

  // Top-level containers = hierarchy roots that have children, plus EVERY
  // root epic — an epic is top-level by definition and renders as its own
  // (possibly empty) box, never in Ungrouped.
  const roots = graph.nodes.filter(
    (n) => !hasParent.has(n.key) && ((childrenOf.get(n.key) ?? []).length > 0 || n.type.kind === 'epic'),
  );
  const containers = roots.map((r) => build(r.key, 0));

  // Orphans: non-epic roots with no children.
  const orphans = graph.nodes.filter(
    (n) => !hasParent.has(n.key) && (childrenOf.get(n.key) ?? []).length === 0 && n.type.kind !== 'epic',
  );
  if (orphans.length) {
    containers.push({ key: '__ungrouped__', node: null, subContainers: [], members: orphans });
  }
  return { containers };
}
