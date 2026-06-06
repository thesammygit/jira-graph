import type { Graph } from '../core/model';
import type { Action, GroupDepth } from '../state/graphReducer';

/**
 * Build the `revealInOverview` action for a ticket: its hierarchy depth
 * (so the Show level can be raised just enough to make it visible) and its
 * ancestor chain (so collapsed boxes above it can be expanded).
 */
export function revealAction(graph: Graph, key: string): Action | null {
  const node = graph.nodes.find((n) => n.key === key);
  if (!node) return null;
  const parentOf = new Map<string, string>();
  for (const e of graph.edges) if (e.kind === 'hierarchy') parentOf.set(e.target, e.source);
  const ancestors: string[] = [];
  let cur = parentOf.get(key), guard = 0;
  while (cur && guard++ < 50) { ancestors.push(cur); cur = parentOf.get(cur); }
  const minDepth = Math.min(4, ancestors.length + 1) as GroupDepth;
  return { type: 'revealInOverview', node, minDepth, ancestors };
}
