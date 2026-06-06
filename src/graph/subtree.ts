import type { Graph, GraphNode } from '../core/model';

export interface SubtreeNode { node: GraphNode; children: SubtreeNode[] }
export interface SubtreeModel { root: SubtreeNode; focusKey: string }

/**
 * The full hierarchy tree a ticket lives in: climb hierarchy parents from the
 * focus ticket to its topmost ancestor (the epic, usually), then expand every
 * descendant. Selecting an epic yields its whole subtree; selecting a task
 * yields the entire tree it belongs to, focus highlighted by the caller.
 */
export function subtreeModel(graph: Graph, focusKey: string): SubtreeModel | null {
  const byKey = new Map(graph.nodes.map((n) => [n.key, n]));
  if (!byKey.has(focusKey)) return null;

  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (e.kind !== 'hierarchy') continue;
    parentOf.set(e.target, e.source);
    const arr = childrenOf.get(e.source) ?? [];
    if (!childrenOf.has(e.source)) childrenOf.set(e.source, arr);
    arr.push(e.target);
  }

  // Climb to the topmost ancestor (cycle-guarded).
  let rootKey = focusKey;
  let guard = 0;
  while (parentOf.has(rootKey) && guard++ < 50) rootKey = parentOf.get(rootKey)!;

  const build = (key: string, depth: number): SubtreeNode | null => {
    const node = byKey.get(key);
    if (!node || depth > 50) return null;
    const children = (childrenOf.get(key) ?? [])
      .map((c) => build(c, depth + 1))
      .filter((c): c is SubtreeNode => Boolean(c));
    return { node, children };
  };

  const root = build(rootKey, 0);
  return root ? { root, focusKey } : null;
}
