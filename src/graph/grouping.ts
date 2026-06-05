import type { Graph, GraphNode } from '../core/model';

export interface GroupContainer {
  key: string;                   // heading ticket key, or '__ungrouped__'
  node: GraphNode | null;        // heading ticket (null for the synthetic Ungrouped bucket)
  subContainers: GroupContainer[];
  members: GraphNode[];          // leaf tickets shown as chips
}
export interface Grouping { containers: GroupContainer[] }

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

  const descendantsFlat = (key: string): GraphNode[] => {
    const out: GraphNode[] = [];
    for (const c of childrenOf.get(key) ?? []) {
      const cn = nodeMap.get(c);
      if (cn) out.push(cn);
      out.push(...descendantsFlat(c));
    }
    return out;
  };

  const build = (key: string, level: number): GroupContainer => {
    const node = nodeMap.get(key) ?? null;
    const subContainers: GroupContainer[] = [];
    const members: GraphNode[] = [];
    for (const childKey of childrenOf.get(key) ?? []) {
      const childHasChildren = (childrenOf.get(childKey) ?? []).length > 0;
      if (level + 1 < depth && childHasChildren) {
        subContainers.push(build(childKey, level + 1));
      } else {
        const cn = nodeMap.get(childKey);
        if (cn) members.push(cn);
        members.push(...descendantsFlat(childKey)); // flatten anything below the depth boundary
      }
    }
    return { key, node, subContainers, members };
  };

  // Top-level containers = hierarchy roots that have children (e.g. epics).
  const roots = graph.nodes.filter((n) => !hasParent.has(n.key) && (childrenOf.get(n.key) ?? []).length > 0);
  const containers = roots.map((r) => build(r.key, 0));

  // Orphans: roots with no children and no parent.
  const orphans = graph.nodes.filter((n) => !hasParent.has(n.key) && (childrenOf.get(n.key) ?? []).length === 0);
  if (orphans.length) {
    containers.push({ key: '__ungrouped__', node: null, subContainers: [], members: orphans });
  }
  return { containers };
}
