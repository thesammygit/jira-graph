import { filterGroupingForState, toGroupedElements } from './grouped-elements';
import { groupGraph } from './grouping';
import { layoutGrouped } from './layouts/grouped';
import type { Graph } from '../core/model';
import type { IssueKind } from '../core/model';
import { initialState } from '../state/graphReducer';

function n(key: string, kind: any, level: number): any { return { id: key, key, summary: key, type: { name: kind, kind }, status: { name: 's', category: 'todo' }, project: { key: 'X', name: 'X' }, hierarchyLevel: level, url: '', raw: {} }; }
function h(p: string, c: string): any { return { id: `h-${p}-${c}`, source: p, target: c, kind: 'hierarchy', relation: 'parent', label: 'p', directed: true, raw: {} }; }
function l(s: string, t: string): any { return { id: `l-${s}-${t}`, source: s, target: t, kind: 'link', relation: 'blocks', label: 'blocks', directed: true, raw: {} }; }

const graph: Graph = {
  nodes: [n('EPIC-1', 'epic', 2), n('STORY-10', 'story', 1), n('TASK-20', 'task', 1), n('EPIC-2', 'epic', 2), n('STORY-30', 'story', 1)],
  edges: [h('EPIC-1', 'STORY-10'), h('STORY-10', 'TASK-20'), h('EPIC-2', 'STORY-30'), l('TASK-20', 'STORY-30')],
};
function build(state: typeof initialState) {
  const grouping = filterGroupingForState(groupGraph(graph, state.groupDepth), state);
  return toGroupedElements(graph, grouping, layoutGrouped(grouping), state);
}

test('emits container nodes and member nodes with parentId', () => {
  const { nodes } = build(initialState);
  const epic = nodes.find((x) => x.id === 'EPIC-1')!;
  expect(epic.type).toBe('container');
  const task = nodes.find((x) => x.id === 'TASK-20');
  expect(task?.type).toBe('ticket');
  expect((task as any)?.parentId).toBeDefined();
});

test('cross-container link is a ticket-to-ticket edge when both endpoints visible', () => {
  const { edges } = build(initialState);
  expect(edges.some((e) => e.source === 'TASK-20' && e.target === 'STORY-30')).toBe(true);
});

test('collapsing a container hides its members and reroutes the edge to the container', () => {
  const collapsed = { ...initialState, collapsed: new Set(['EPIC-1']) };
  const { nodes, edges } = build(collapsed);
  expect(nodes.some((x) => x.id === 'TASK-20')).toBe(false);   // member hidden
  expect(nodes.some((x) => x.id === 'EPIC-1')).toBe(true);     // container still shown
  // edge endpoint TASK-20 rerouted up to EPIC-1
  expect(edges.some((e) => e.source === 'EPIC-1' && e.target === 'STORY-30')).toBe(true);
});

test('collapsing a NESTED container reroutes to that container, not the outer epic', () => {
  const collapsed = { ...initialState, collapsed: new Set(['STORY-10']) }; // EPIC-1 stays open
  const { nodes, edges } = build(collapsed);
  expect(nodes.some((x) => x.id === 'TASK-20')).toBe(false);   // member hidden
  expect(nodes.some((x) => x.id === 'STORY-10')).toBe(true);   // nested container still shown
  expect(edges.some((e) => e.source === 'STORY-10' && e.target === 'STORY-30')).toBe(true);
  expect(edges.some((e) => e.source === 'EPIC-1')).toBe(false); // NOT rerouted to the epic
});

test('parent container nodes are ordered before their child nodes (React Flow requirement)', () => {
  const { nodes } = build(initialState);
  const idx = (id: string) => nodes.findIndex((n) => n.id === id);
  expect(idx('EPIC-1')).toBeLessThan(idx('STORY-10')); // epic before its sub-container
  expect(idx('STORY-10')).toBeLessThan(idx('TASK-20')); // sub-container before its member
});

test('type filters remove grouped containers and members that no longer match', () => {
  const epicsOnly = {
    ...initialState,
    hiddenTypes: new Set<IssueKind>(['story', 'task', 'subtask', 'bug']),
  };
  const { nodes, edges } = build(epicsOnly);
  expect(nodes.map((x) => x.id).sort()).toEqual(['EPIC-1', 'EPIC-2']);
  expect(edges).toHaveLength(0);
});

test('project filters remove every grouped box for that project', () => {
  const hiddenProject = { ...initialState, hiddenProjects: new Set(['X']) };
  const { nodes, edges } = build(hiddenProject);
  expect(nodes).toHaveLength(0);
  expect(edges).toHaveLength(0);
});

test('container-to-container links (epic↔epic) render as edges between the boxes', () => {
  // Both endpoints are container boxes (epics), not leaf members. Previously these
  // resolved to null and the edge was dropped — so "epics linked together" never showed.
  const g: Graph = {
    nodes: [n('EPIC-1', 'epic', 2), n('STORY-10', 'story', 1), n('EPIC-2', 'epic', 2), n('STORY-30', 'story', 1)],
    edges: [h('EPIC-1', 'STORY-10'), h('EPIC-2', 'STORY-30'), l('EPIC-1', 'EPIC-2')],
  };
  const grouping = filterGroupingForState(groupGraph(g, initialState.groupDepth), initialState);
  const { edges } = toGroupedElements(g, grouping, layoutGrouped(grouping), initialState);
  expect(edges.some((e) => e.source === 'EPIC-1' && e.target === 'EPIC-2')).toBe(true);
});
