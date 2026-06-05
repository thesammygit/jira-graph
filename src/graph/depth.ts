import type { Graph } from '../core/model';

function getOrCreate(map: Map<string, string[]>, key: string): string[] {
  let arr = map.get(key);
  if (!arr) { arr = []; map.set(key, arr); }
  return arr;
}

export function neighborhood(graph: Graph, focusKey: string, depth: number): Graph {
  const adj = new Map<string, string[]>();
  for (const e of graph.edges) {
    getOrCreate(adj, e.source).push(e.target);
    getOrCreate(adj, e.target).push(e.source);
  }
  const dist = new Map<string, number>([[focusKey, 0]]);
  let frontier = [focusKey];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const k of frontier) {
      for (const nb of adj.get(k) ?? []) {
        if (!dist.has(nb)) { dist.set(nb, d + 1); next.push(nb); }
      }
    }
    frontier = next;
  }
  const nodes = graph.nodes.filter((n) => dist.has(n.key));
  const edges = graph.edges.filter((e) => dist.has(e.source) && dist.has(e.target));
  return { nodes, edges };
}
