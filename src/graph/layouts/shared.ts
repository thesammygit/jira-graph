import type { Graph, GraphNode } from '../../core/model';

export interface DepthLayout {
  /** Rows ordered top (depth 0) to bottom, grouped by tree depth. */
  rows: GraphNode[][];
  /** Contiguous row index per node key (use for y = index * ROW_H). */
  depthOf: Map<string, number>;
}

/**
 * Layer nodes by their ACTUAL depth in the hierarchy tree (longest path from a
 * root along `hierarchy` edges) rather than the coarse 3-value `hierarchyLevel`.
 * This spreads epic ▸ story ▸ task ▸ subtask into distinct rows instead of
 * collapsing every story/task/bug into one giant row. Orphans and link-only
 * nodes sit at depth 0. Cycle-safe (topological; any leftover stays at 0).
 */
export function rowsByDepth(graph: Graph): DepthLayout {
  const adj = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const n of graph.nodes) indegree.set(n.key, 0);
  for (const e of graph.edges) {
    if (e.kind !== 'hierarchy') continue;
    const arr = adj.get(e.source) ?? [];
    if (!adj.has(e.source)) adj.set(e.source, arr);
    arr.push(e.target);
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
  }

  const depth = new Map<string, number>();
  for (const n of graph.nodes) depth.set(n.key, 0);
  // Kahn topological order; longest-path relaxation gives each node max(parentDepth)+1.
  const remaining = new Map(indegree);
  const queue = graph.nodes.filter((n) => (remaining.get(n.key) ?? 0) === 0).map((n) => n.key);
  while (queue.length) {
    const k = queue.shift()!;
    for (const c of adj.get(k) ?? []) {
      depth.set(c, Math.max(depth.get(c) ?? 0, (depth.get(k) ?? 0) + 1));
      const d = (remaining.get(c) ?? 0) - 1;
      remaining.set(c, d);
      if (d === 0) queue.push(c);
    }
  }

  const byDepth = new Map<number, GraphNode[]>();
  for (const n of graph.nodes) {
    const d = depth.get(n.key) ?? 0;
    const arr = byDepth.get(d) ?? [];
    if (!byDepth.has(d)) byDepth.set(d, arr);
    arr.push(n);
  }
  const sortedDepths = [...byDepth.keys()].sort((a, b) => a - b);
  const rowIndex = new Map<number, number>();
  sortedDepths.forEach((d, i) => rowIndex.set(d, i)); // collapse gaps so rows are contiguous
  const depthOf = new Map<string, number>();
  for (const n of graph.nodes) depthOf.set(n.key, rowIndex.get(depth.get(n.key) ?? 0)!);

  return { rows: sortedDepths.map((d) => byDepth.get(d)!), depthOf };
}
