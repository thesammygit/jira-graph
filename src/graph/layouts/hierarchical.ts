import type { Graph } from '../../core/model';
import type { Positions } from './types';
import { COL_W, ROW_H } from './types';
import { rowsByDepth } from './shared';

export function hierarchical(graph: Graph): Positions {
  const { rows, depthOf } = rowsByDepth(graph);
  const pos: Positions = new Map();
  for (const row of rows) {
    row.forEach((node, i) => pos.set(node.key, { x: i * COL_W, y: (depthOf.get(node.key) ?? 0) * ROW_H }));
  }
  barycenter(graph, rows, pos);
  return pos;
}

/** Sweeps: pull each node toward the mean x of its hierarchy-connected neighbors, then de-overlap per row. */
function barycenter(graph: Graph, rows: ReturnType<typeof rowsByDepth>['rows'], pos: Positions): void {
  const neighbors = new Map<string, string[]>();
  const add = (a: string, b: string) => {
    const arr = neighbors.get(a) ?? [];
    if (!neighbors.has(a)) neighbors.set(a, arr);
    arr.push(b);
  };
  for (const e of graph.edges) {
    if (e.kind !== 'hierarchy') continue;
    add(e.source, e.target);
    add(e.target, e.source);
  }
  for (let sweep = 0; sweep < 4; sweep++) {
    for (const row of rows) {
      for (const node of row) {
        const nbs = neighbors.get(node.key) ?? [];
        if (nbs.length) {
          const mean = nbs.reduce((s, k) => s + (pos.get(k)?.x ?? 0), 0) / nbs.length;
          pos.get(node.key)!.x = mean;
        }
      }
      const sorted = [...row].sort((a, b) => pos.get(a.key)!.x - pos.get(b.key)!.x);
      for (let i = 1; i < sorted.length; i++) {
        const prev = pos.get(sorted[i - 1].key)!, cur = pos.get(sorted[i].key)!;
        if (cur.x - prev.x < COL_W) cur.x = prev.x + COL_W;
      }
    }
  }
}
