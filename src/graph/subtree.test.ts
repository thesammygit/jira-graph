import { forestModel, subtreeModel } from './subtree';
import type { Graph } from '../core/model';

function n(key: string, kind: any = 'task'): any { return { id: key, key, summary: key, type: { name: kind, kind }, status: { name: 's', category: 'todo' }, project: { key: 'P', name: 'P' }, labels: [], components: [], hierarchyLevel: 1, url: '', raw: {} }; }
function h(p: string, c: string): any { return { id: `h-${p}-${c}`, source: p, target: c, kind: 'hierarchy', relation: 'parent', label: 'p', directed: true, raw: {} }; }

// EPIC ▸ {S1 ▸ {T1 ▸ {U1}}, S2}
const graph: Graph = {
  nodes: [n('EPIC', 'epic'), n('S1', 'story'), n('S2', 'story'), n('T1', 'task'), n('U1', 'subtask')],
  edges: [h('EPIC', 'S1'), h('EPIC', 'S2'), h('S1', 'T1'), h('T1', 'U1')],
};

test('selecting a deep task climbs to the epic and returns the WHOLE tree', () => {
  const m = subtreeModel(graph, 'T1')!;
  expect(m.root.node.key).toBe('EPIC');
  expect(m.focusKey).toBe('T1');
  expect(m.root.children.map((c) => c.node.key).sort()).toEqual(['S1', 'S2']);
  const s1 = m.root.children.find((c) => c.node.key === 'S1')!;
  expect(s1.children[0].node.key).toBe('T1');
  expect(s1.children[0].children[0].node.key).toBe('U1');
});

test('selecting the epic itself returns its subtree', () => {
  const m = subtreeModel(graph, 'EPIC')!;
  expect(m.root.node.key).toBe('EPIC');
});

test('forestModel returns every root tree — trees with children first, loose tickets after', () => {
  const g: Graph = {
    nodes: [n('LONE'), n('EPIC', 'epic'), n('S1', 'story'), n('EPIC2', 'epic'), n('S9', 'story')],
    edges: [h('EPIC', 'S1'), h('EPIC2', 'S9')],
  };
  const forest = forestModel(g);
  expect(forest.map((t) => t.node.key)).toEqual(['EPIC', 'EPIC2', 'LONE']);
  expect(forest[0].children[0].node.key).toBe('S1');
});

test('null for an unknown key; orphan tickets are their own root', () => {
  expect(subtreeModel(graph, 'NOPE')).toBeNull();
  const lone: Graph = { nodes: [n('X')], edges: [] };
  expect(subtreeModel(lone, 'X')!.root.node.key).toBe('X');
});
