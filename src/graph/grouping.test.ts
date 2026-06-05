import { groupGraph } from './grouping';
import type { Graph } from '../core/model';

function n(key: string, level: number): any { return { id: key, key, summary: key, type: { name: 't', kind: 'task' }, status: { name: 's', category: 'todo' }, hierarchyLevel: level, url: '', raw: {} }; }
function h(p: string, c: string): any { return { id: `h-${p}-${c}`, source: p, target: c, kind: 'hierarchy', relation: 'parent', label: 'p', directed: true, raw: {} }; }

// EPIC-1 → STORY-10 → {TASK-20, SUB-30}; EPIC-1 → TASK-99 (direct); plus an orphan BUG-1
const graph: Graph = {
  nodes: [n('EPIC-1', 2), n('STORY-10', 1), n('TASK-20', 1), n('SUB-30', 0), n('TASK-99', 1), n('BUG-1', 1)],
  edges: [h('EPIC-1', 'STORY-10'), h('STORY-10', 'TASK-20'), h('STORY-10', 'SUB-30'), h('EPIC-1', 'TASK-99')],
};

test('depth 1: epic container holds ALL descendants flat, no sub-containers', () => {
  const g = groupGraph(graph, 1);
  const epic = g.containers.find((c) => c.key === 'EPIC-1')!;
  expect(epic.subContainers).toHaveLength(0);
  expect(epic.members.map((m) => m.key).sort()).toEqual(['STORY-10', 'SUB-30', 'TASK-20', 'TASK-99']);
});

test('depth 2: epic holds STORY-10 as a sub-container (with its members) + TASK-99 as a direct member', () => {
  const g = groupGraph(graph, 2);
  const epic = g.containers.find((c) => c.key === 'EPIC-1')!;
  expect(epic.subContainers.map((s) => s.key)).toEqual(['STORY-10']);
  expect(epic.subContainers[0].members.map((m) => m.key).sort()).toEqual(['SUB-30', 'TASK-20']);
  expect(epic.members.map((m) => m.key)).toEqual(['TASK-99']);
});

test('orphans with no parent and no children go in a synthetic Ungrouped container', () => {
  const g = groupGraph(graph, 2);
  const ung = g.containers.find((c) => c.key === '__ungrouped__');
  expect(ung?.members.map((m) => m.key)).toEqual(['BUG-1']);
});
