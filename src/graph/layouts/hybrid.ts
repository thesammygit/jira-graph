import type { Graph } from '../../core/model';
import type { Positions } from './types';
import { COL_W, ROW_H } from './types';
import { rowsByDepth } from './shared';

/**
 * Hierarchical backbone (y by true tree depth) but the horizontal barycenter pass
 * also accounts for LINK edges, so link-connected nodes drift closer together —
 * giving cleaner, shorter cross-links than strict hierarchical rows.
 */
export function hybrid(graph: Graph): Positions {
  const { rows, depthOf } = rowsByDepth(graph);
  const pos: Positions = new Map();
  for (const row of rows) row.forEach((node, i) => pos.set(node.key, { x: i * COL_W, y: (depthOf.get(node.key) ?? 0) * ROW_H }));

  const neighbors = new Map<string, string[]>();
  const add = (a: string, b: string) => {
    const arr = neighbors.get(a) ?? [];
    if (!neighbors.has(a)) neighbors.set(a, arr);
    arr.push(b);
  };
  for (const e of graph.edges) { // ALL edges, hierarchy + link
    add(e.source, e.target);
    add(e.target, e.source);
  }
  for (let sweep = 0; sweep < 6; sweep++) {
    for (const row of rows) {
      for (const node of row) {
        const nbs = neighbors.get(node.key) ?? [];
        if (nbs.length) pos.get(node.key)!.x = nbs.reduce((s, k) => s + (pos.get(k)?.x ?? 0), 0) / nbs.length;
      }
      const sorted = [...row].sort((a, b) => pos.get(a.key)!.x - pos.get(b.key)!.x);
      for (let i = 1; i < sorted.length; i++) {
        const prev = pos.get(sorted[i - 1].key)!, cur = pos.get(sorted[i].key)!;
        if (cur.x - prev.x < COL_W) cur.x = prev.x + COL_W;
      }
    }
  }
  return pos;
}
