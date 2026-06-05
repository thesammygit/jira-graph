import type { Graph, GraphNode } from '../core/model';

export interface TreeBadge { relation: string; label: string; otherKey: string; direction: 'out' | 'in' }
export interface TreeRow { key: string; node: GraphNode; depth: number; children: TreeRow[]; links: TreeBadge[] }

export function buildTree(graph: Graph): TreeRow[] {
  const nodeMap = new Map(graph.nodes.map((n) => [n.key, n]));
  const childrenOf = new Map<string, string[]>();
  const hasParent = new Set<string>();
  const links = new Map<string, TreeBadge[]>();

  for (const e of graph.edges) {
    if (e.kind === 'hierarchy') {
      const arr = childrenOf.get(e.source) ?? [];
      if (!childrenOf.has(e.source)) childrenOf.set(e.source, arr);
      arr.push(e.target);
      hasParent.add(e.target);
    } else {
      const sArr = links.get(e.source) ?? []; if (!links.has(e.source)) links.set(e.source, sArr);
      sArr.push({ relation: e.relation, label: e.label, otherKey: e.target, direction: 'out' });
      const tArr = links.get(e.target) ?? []; if (!links.has(e.target)) links.set(e.target, tArr);
      tArr.push({ relation: e.relation, label: e.label, otherKey: e.source, direction: 'in' });
    }
  }

  const build = (key: string, depth: number): TreeRow => ({
    key, node: nodeMap.get(key)!, depth,
    children: (childrenOf.get(key) ?? []).map((c) => build(c, depth + 1)),
    links: links.get(key) ?? [],
  });

  return graph.nodes.filter((n) => !hasParent.has(n.key)).map((r) => build(r.key, 0));
}
