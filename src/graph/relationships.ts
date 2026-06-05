import type { Graph } from '../core/model';

export interface RelRow { kind: 'hierarchy' | 'link'; relation: string; label: string; otherKey: string; outward: boolean }

export function ticketRelationships(graph: Graph, key: string): RelRow[] {
  const rows: RelRow[] = [];
  for (const e of graph.edges) {
    if (e.source === key) rows.push({ kind: e.kind, relation: e.relation, label: e.label, otherKey: e.target, outward: true });
    else if (e.target === key) rows.push({ kind: e.kind, relation: e.relation, label: e.label, otherKey: e.source, outward: false });
  }
  return rows;
}
