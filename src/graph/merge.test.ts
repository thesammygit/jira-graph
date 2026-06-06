import { mergeGraphs } from './merge';
import type { Graph } from '../core/model';

function n(key: string): any { return { id: key, key, summary: key, type: { name: 't', kind: 'task' }, status: { name: 's', category: 'todo' }, project: { key: 'P', name: 'P' }, labels: [], components: [], hierarchyLevel: 1, url: '', raw: null }; }
function e(id: string, s: string, t: string): any { return { id, source: s, target: t, kind: 'link', relation: 'blocks', label: 'b', directed: true, raw: null }; }

test('mergeGraphs dedupes nodes by key (newer wins) and edges by id', () => {
  const base: Graph = { nodes: [n('A'), n('B')], edges: [e('1', 'A', 'B')] };
  const chunk: Graph = { nodes: [{ ...n('B'), summary: 'B2' }, n('C')], edges: [e('1', 'A', 'B'), e('2', 'B', 'C')] };
  const out = mergeGraphs(base, chunk);
  expect(out.nodes.map((x) => x.key).sort()).toEqual(['A', 'B', 'C']);
  expect(out.nodes.find((x) => x.key === 'B')!.summary).toBe('B2');
  expect(out.edges).toHaveLength(2);
});

test('keeps dangling edges so they light up when the other side loads later', () => {
  const base: Graph = { nodes: [n('A')], edges: [e('1', 'A', 'ZZZ-NOT-LOADED')] };
  const out = mergeGraphs(base, { nodes: [n('ZZZ-NOT-LOADED')], edges: [] });
  expect(out.edges).toHaveLength(1);
});
