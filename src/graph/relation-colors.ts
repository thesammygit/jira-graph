import type { Graph } from '../core/model';

export interface RelationStyle { key: string; label: string; colorVar: string }

const KNOWN: Record<string, string> = {
  hierarchy: 'var(--rel-hierarchy)', blocks: 'var(--rel-blocks)', relates: 'var(--rel-relates)',
  duplicates: 'var(--rel-duplicates)', clones: 'var(--rel-clones)',
};

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function relationStyle(relation: string): RelationStyle {
  return { key: relation, label: cap(relation), colorVar: KNOWN[relation] ?? 'var(--rel-default)' };
}

/** All relation keys present in the graph (hierarchy edges collapse to 'hierarchy'), deduped. */
export function legendEntries(graph: Graph): RelationStyle[] {
  const keys = new Set<string>();
  for (const e of graph.edges) keys.add(e.kind === 'hierarchy' ? 'hierarchy' : e.relation);
  return [...keys].map(relationStyle);
}
