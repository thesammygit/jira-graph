import { neighborhood } from './depth';
import type { Graph } from '../core/model';

function node(key: string): any { return { id: key, key, summary: key, type: { name: 't', kind: 'task' }, status: { name: 's', category: 'todo' }, hierarchyLevel: 1, url: '', raw: {} }; }
function edge(s: string, t: string): any { return { id: `${s}-${t}`, source: s, target: t, kind: 'link', relation: 'blocks', label: 'b', directed: true, raw: {} }; }

// A - B - C - D  (a chain)
const graph: Graph = { nodes: ['A', 'B', 'C', 'D'].map(node), edges: [edge('A', 'B'), edge('B', 'C'), edge('C', 'D')] };

test('depth 1 returns focus + direct neighbors', () => {
  const g = neighborhood(graph, 'B', 1);
  expect(g.nodes.map((n) => n.key).sort()).toEqual(['A', 'B', 'C']);
  expect(g.edges.map((e) => e.id).sort()).toEqual(['A-B', 'B-C']);
});

test('depth 2 reaches two hops, treating edges as undirected', () => {
  const g = neighborhood(graph, 'A', 2);
  expect(g.nodes.map((n) => n.key).sort()).toEqual(['A', 'B', 'C']);
});

test('depth 0 returns only the focus node', () => {
  const g = neighborhood(graph, 'C', 0);
  expect(g.nodes.map((n) => n.key)).toEqual(['C']);
  expect(g.edges).toHaveLength(0);
});
