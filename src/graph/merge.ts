import type { Graph } from '../core/model';

/**
 * Merge an incrementally-fetched chunk into the working graph: nodes dedupe
 * by key (newer wins), edges by id. Edges may reference not-yet-loaded
 * tickets — every consumer (grouping, routing, spotlight) already skips
 * endpoints it can't resolve, and the edge lights up once its other side
 * arrives in a later chunk.
 */
export function mergeGraphs(base: Graph, chunk: Graph): Graph {
  const nodeMap = new Map(base.nodes.map((n) => [n.key, n]));
  for (const n of chunk.nodes) nodeMap.set(n.key, n);
  const edgeMap = new Map(base.edges.map((e) => [e.id, e]));
  for (const e of chunk.edges) edgeMap.set(e.id, e);
  return { nodes: [...nodeMap.values()], edges: [...edgeMap.values()] };
}
