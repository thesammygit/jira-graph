import type { Graph, GraphNode } from '../../core/model';
import { ROW_H } from './types';

/** Group nodes by hierarchyLevel; return rows ordered top (highest level) to bottom. */
export function rowsByLevel(graph: Graph): GraphNode[][] {
  const byLevel = new Map<number, GraphNode[]>();
  for (const node of graph.nodes) {
    const arr = byLevel.get(node.hierarchyLevel) ?? [];
    if (!byLevel.has(node.hierarchyLevel)) byLevel.set(node.hierarchyLevel, arr);
    arr.push(node);
  }
  return [...byLevel.keys()].sort((a, b) => b - a).map((lvl) => byLevel.get(lvl)!);
}

export function yForLevel(level: number, maxLevel: number): number {
  return (maxLevel - level) * ROW_H;
}
