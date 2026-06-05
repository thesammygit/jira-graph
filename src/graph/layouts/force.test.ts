import { force } from './force';
import type { Graph } from '../../core/model';

function n(key: string): any { return { id: key, key, summary: key, type: { name: 't', kind: 'task' }, status: { name: 's', category: 'todo' }, hierarchyLevel: 1, url: '', raw: {} }; }
function e(s: string, t: string): any { return { id: `${s}-${t}`, source: s, target: t, kind: 'link', relation: 'relates', label: 'r', directed: false, raw: {} }; }

const graph: Graph = { nodes: ['A', 'B', 'C'].map(n), edges: [e('A', 'B'), e('B', 'C')] };

test('positions every node with finite coordinates', () => {
  const pos = force(graph);
  expect(pos.size).toBe(3);
  for (const p of pos.values()) { expect(Number.isFinite(p.x)).toBe(true); expect(Number.isFinite(p.y)).toBe(true); }
});

test('is deterministic (seeded, no randomness)', () => {
  expect([...force(graph).entries()]).toEqual([...force(graph).entries()]);
});
