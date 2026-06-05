import { buildTree } from './tree';
import type { Graph } from '../core/model';

function n(key: string, level: number): any { return { id: key, key, summary: key, type: { name: 't', kind: 'task' }, status: { name: 's', category: 'todo' }, hierarchyLevel: level, url: '', raw: {} }; }
function h(p: string, c: string): any { return { id: `h-${p}-${c}`, source: p, target: c, kind: 'hierarchy', relation: 'parent', label: 'p', directed: true, raw: {} }; }
function l(s: string, t: string): any { return { id: `l-${s}-${t}`, source: s, target: t, kind: 'link', relation: 'blocks', label: 'blocks', directed: true, raw: {} }; }

const graph: Graph = {
  nodes: [n('EPIC-1', 2), n('STORY-10', 1), n('TASK-20', 1), n('BUG-1', 1)],
  edges: [h('EPIC-1', 'STORY-10'), h('STORY-10', 'TASK-20'), l('BUG-1', 'STORY-10')],
};

test('roots are nodes with no hierarchy parent; children nest by hierarchy', () => {
  const rows = buildTree(graph);
  const epic = rows.find((r) => r.key === 'EPIC-1')!;
  expect(epic.depth).toBe(0);
  expect(epic.children.map((c) => c.key)).toEqual(['STORY-10']);
  expect(epic.children[0].children.map((c) => c.key)).toEqual(['TASK-20']);
});

test('link relationships attach to the row as badges', () => {
  const rows = buildTree(graph);
  const story = rows.find((r) => r.key === 'EPIC-1')!.children[0];
  // STORY-10 is blocked by BUG-1 (inward) → badge present referencing BUG-1
  expect(story.links.some((b) => b.otherKey === 'BUG-1')).toBe(true);
});
