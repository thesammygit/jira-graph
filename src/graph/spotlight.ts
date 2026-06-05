import type { Graph, GraphNode } from '../core/model';

export interface SpotlightModel {
  hero: GraphNode;
  epic?: GraphNode;
  parent?: GraphNode;
  children: GraphNode[];
  blocks: GraphNode[];
  blockedBy: GraphNode[];
  relates: GraphNode[];
  other: { relation: string; label: string; node: GraphNode; outward: boolean }[];
}

const UNDIRECTED = new Set(['relates', 'relate', 'relates to']);

export function spotlightModel(graph: Graph, focusKey: string): SpotlightModel | null {
  const byKey = new Map(graph.nodes.map((n) => [n.key, n]));
  const hero = byKey.get(focusKey);
  if (!hero) return null;

  const used = new Set<string>([focusKey]);
  const take = (key: string | undefined): GraphNode | undefined => {
    if (!key || used.has(key)) return undefined;
    const node = byKey.get(key);
    if (!node) return undefined;
    used.add(key);
    return node;
  };

  // Epic (resolved ancestor) first, then direct hierarchy parent.
  const epic = hero.type.kind === 'epic' ? undefined : take(hero.epicKey);

  let parent: GraphNode | undefined;
  const children: GraphNode[] = [];
  const blocks: GraphNode[] = [];
  const blockedBy: GraphNode[] = [];
  const relates: GraphNode[] = [];
  const other: SpotlightModel['other'] = [];

  for (const e of graph.edges) {
    if (e.kind === 'hierarchy') {
      if (e.target === focusKey) { const p = take(e.source); if (p) parent = p; }
      else if (e.source === focusKey) { const c = take(e.target); if (c) children.push(c); }
      continue;
    }
    // link edges
    const outward = e.source === focusKey;
    const inward = e.target === focusKey;
    if (!outward && !inward) continue;
    const otherKey = outward ? e.target : e.source;
    const node = take(otherKey);
    if (!node) continue;
    const rel = e.relation.toLowerCase();
    if (rel === 'blocks') { (outward ? blocks : blockedBy).push(node); }
    else if (UNDIRECTED.has(rel)) { relates.push(node); }
    else { other.push({ relation: rel, label: e.label, node, outward }); }
  }

  return { hero, epic, parent, children, blocks, blockedBy, relates, other };
}
