import { filterGroupingForState, toGroupedElements } from './grouped-elements';
import { groupGraph } from './grouping';
import { layoutGrouped } from './layouts/grouped';
import type { Graph } from '../core/model';
import type { IssueKind } from '../core/model';
import { initialState } from '../state/graphReducer';

function n(key: string, kind: any, level: number): any { return { id: key, key, summary: key, type: { name: kind, kind }, status: { name: 's', category: 'todo' }, project: { key: 'X', name: 'X' }, hierarchyLevel: level, url: '', raw: {} }; }
function h(p: string, c: string): any { return { id: `h-${p}-${c}`, source: p, target: c, kind: 'hierarchy', relation: 'parent', label: 'p', directed: true, raw: {} }; }
function l(s: string, t: string): any { return { id: `l-${s}-${t}`, source: s, target: t, kind: 'link', relation: 'blocks', label: 'blocks', directed: true, raw: {} }; }

// EPIC-1 ▸ STORY-10 ▸ TASK-20, plus STORY-99 directly under EPIC-1.
// EPIC-2 ▸ STORY-30. Cross-box link TASK-20→STORY-30; same-box link TASK-20→STORY-99.
const graph: Graph = {
  nodes: [n('EPIC-1', 'epic', 2), n('STORY-10', 'story', 1), n('TASK-20', 'task', 1), n('STORY-99', 'story', 1), n('EPIC-2', 'epic', 2), n('STORY-30', 'story', 1)],
  edges: [h('EPIC-1', 'STORY-10'), h('STORY-10', 'TASK-20'), h('EPIC-1', 'STORY-99'), h('EPIC-2', 'STORY-30'), l('TASK-20', 'STORY-30'), l('TASK-20', 'STORY-99')],
};
function build(state: typeof initialState, g: Graph = graph) {
  const grouping = filterGroupingForState(groupGraph(g, state.groupDepth), state);
  return toGroupedElements(g, grouping, layoutGrouped(grouping), state);
}

test('emits container nodes and member nodes with parentId', () => {
  const { nodes } = build(initialState);
  const epic = nodes.find((x) => x.id === 'EPIC-1')!;
  expect(epic.type).toBe('container');
  const task = nodes.find((x) => x.id === 'TASK-20');
  expect(task?.type).toBe('ticket');
  expect((task as any)?.parentId).toBeDefined();
});

test('cross-box links aggregate to ONE wall-to-wall wire per box pair, keeping the real tickets in data', () => {
  const { edges } = build(initialState);
  const wire = edges.find((e) => e.source === 'EPIC-1' && e.target === 'EPIC-2');
  expect(wire).toBeTruthy();
  expect((wire!.data as any).srcKey).toBe('TASK-20');
  expect((wire!.data as any).tgtKey).toBe('STORY-30');
  // and no raw ticket-to-ticket wire across boxes
  expect(edges.some((e) => e.source === 'TASK-20' && e.target === 'STORY-30')).toBe(false);
});

test('same-box links stay ticket-to-ticket', () => {
  const { edges } = build(initialState);
  expect(edges.some((e) => e.source === 'TASK-20' && e.target === 'STORY-99')).toBe(true);
});

test('collapsing the epic keeps the aggregated box wire and hides the members', () => {
  const collapsed = { ...initialState, collapsed: new Set(['EPIC-1']) };
  const { nodes, edges } = build(collapsed);
  expect(nodes.some((x) => x.id === 'TASK-20')).toBe(false);
  expect(nodes.some((x) => x.id === 'EPIC-1')).toBe(true);
  expect(edges.some((e) => e.source === 'EPIC-1' && e.target === 'EPIC-2')).toBe(true);
});

test('collapsing a NESTED box reroutes same-box links to that box, not the outer epic', () => {
  const collapsed = { ...initialState, collapsed: new Set(['STORY-10']) }; // EPIC-1 stays open
  const { nodes, edges } = build(collapsed);
  expect(nodes.some((x) => x.id === 'TASK-20')).toBe(false);   // member hidden
  expect(nodes.some((x) => x.id === 'STORY-10')).toBe(true);   // nested box still shown
  expect(edges.some((e) => e.source === 'STORY-10' && e.target === 'STORY-99')).toBe(true);
});

test('parent container nodes are ordered before their child nodes (React Flow requirement)', () => {
  const { nodes } = build(initialState);
  const idx = (id: string) => nodes.findIndex((x) => x.id === id);
  expect(idx('EPIC-1')).toBeLessThan(idx('STORY-10'));
  expect(idx('STORY-10')).toBeLessThan(idx('TASK-20'));
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
  const g: Graph = {
    nodes: [n('EPIC-1', 'epic', 2), n('STORY-10', 'story', 1), n('EPIC-2', 'epic', 2), n('STORY-30', 'story', 1)],
    edges: [h('EPIC-1', 'STORY-10'), h('EPIC-2', 'STORY-30'), l('EPIC-1', 'EPIC-2')],
  };
  const { edges } = build(initialState, g);
  expect(edges.some((e) => e.source === 'EPIC-1' && e.target === 'EPIC-2')).toBe(true);
});

test('boxes over the member cap show MEMBER_CAP chips + a "+N more" cell; expandBox lifts it', () => {
  const many: Graph = {
    nodes: [n('BIG-0', 'epic', 2), ...Array.from({ length: 45 }, (_, i) => n(`BIG-${i + 1}`, 'task', 1))],
    edges: Array.from({ length: 45 }, (_, i) => h('BIG-0', `BIG-${i + 1}`)),
  };
  const { nodes } = build(initialState, many);
  const chips = nodes.filter((x) => x.type === 'ticket');
  const more = nodes.find((x) => x.type === 'moreChip');
  expect(chips).toHaveLength(30);
  expect(more).toBeTruthy();
  expect((more!.data as any).label).toBe('+15 more');
  expect((more!.data as any).boxKey).toBe('BIG-0');
  // expanding the box shows everything
  const expanded = { ...initialState, expandedBoxes: new Set(['BIG-0']) };
  const all = build(expanded, many);
  expect(all.nodes.filter((x) => x.type === 'ticket')).toHaveLength(45);
  expect(all.nodes.some((x) => x.type === 'moreChip')).toBe(false);
});

test('links from tickets tucked behind the +N-more cell re-aggregate onto the box', () => {
  const many: Graph = {
    nodes: [n('BIG-0', 'epic', 2), ...Array.from({ length: 40 }, (_, i) => n(`BIG-${i + 1}`, 'task', 1)),
            n('OTHER-0', 'epic', 2), n('OTHER-1', 'task', 1)],
    edges: [...Array.from({ length: 40 }, (_, i) => h('BIG-0', `BIG-${i + 1}`)), h('OTHER-0', 'OTHER-1'),
            l('BIG-40', 'OTHER-1')], // BIG-40 is past the cap
  };
  const { edges } = build(initialState, many);
  const wire = edges.find((e) => e.source === 'BIG-0' && e.target === 'OTHER-0');
  expect(wire).toBeTruthy();
  expect((wire!.data as any).srcKey).toBe('BIG-40');
});

test('depth cut re-aggregates truncated-ticket links to the visible ancestor boxes', () => {
  const epicDepth = { ...initialState, groupDepth: 1 as const };
  const { nodes, edges } = build(epicDepth);
  // only the epic boxes render…
  expect(nodes.map((x) => x.id).sort()).toEqual(['EPIC-1', 'EPIC-2']);
  // …and the TASK-20→STORY-30 link climbs to an EPIC-1→EPIC-2 wire
  const wire = edges.find((e) => e.source === 'EPIC-1' && e.target === 'EPIC-2');
  expect(wire).toBeTruthy();
  expect((wire!.data as any).srcKey).toBe('TASK-20');
});

test('linkLevel hides wires whose tickets sit below the chosen level', () => {
  // Both module-graph links involve TASK-20 (a task), so story-and-up shows none.
  const storyUp = { ...initialState, linkLevel: 'story' as const };
  expect(build(storyUp).edges).toHaveLength(0);
  // task-and-up keeps them (no subtask endpoints in this graph)
  const taskUp = { ...initialState, linkLevel: 'task' as const };
  expect(build(taskUp).edges.length).toBeGreaterThan(0);
});
