import { hierarchical } from './hierarchical';
import type { Graph } from '../../core/model';

function n(key: string, level: number): any { return { id: key, key, summary: key, type: { name: 't', kind: 'task' }, status: { name: 's', category: 'todo' }, hierarchyLevel: level, url: '', raw: {} }; }
function e(s: string, t: string): any { return { id: `${s}-${t}`, source: s, target: t, kind: 'hierarchy', relation: 'parent', label: 'p', directed: true, raw: {} }; }

const graph: Graph = { nodes: [n('E', 2), n('S1', 1), n('S2', 1), n('T', 0)], edges: [e('E', 'S1'), e('E', 'S2'), e('S1', 'T')] };

test('higher hierarchy levels get smaller y (placed above)', () => {
  const pos = hierarchical(graph);
  expect(pos.get('E')!.y).toBeLessThan(pos.get('S1')!.y);
  expect(pos.get('S1')!.y).toBeLessThan(pos.get('T')!.y);
});

test('every node receives a finite, unique position', () => {
  const pos = hierarchical(graph);
  expect(pos.size).toBe(4);
  const seen = new Set([...pos.values()].map((p) => `${p.x},${p.y}`));
  expect(seen.size).toBe(4);
  for (const p of pos.values()) { expect(Number.isFinite(p.x)).toBe(true); expect(Number.isFinite(p.y)).toBe(true); }
});

test('is deterministic', () => {
  expect([...hierarchical(graph).entries()]).toEqual([...hierarchical(graph).entries()]);
});
