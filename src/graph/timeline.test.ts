import { buildTimeline } from './timeline';
import type { Graph } from '../core/model';

function n(key: string, kind: any, start?: string, due?: string): any { return { id: key, key, summary: key, type: { name: kind, kind }, status: { name: 's', category: 'todo' }, hierarchyLevel: kind === 'epic' ? 2 : 1, url: '', raw: {}, startDate: start, dueDate: due }; }
function h(p: string, c: string): any { return { id: `h-${p}-${c}`, source: p, target: c, kind: 'hierarchy', relation: 'epic', label: 'epic', directed: true, raw: {} }; }
function blk(s: string, t: string): any { return { id: `l-${s}-${t}`, source: s, target: t, kind: 'link', relation: 'blocks', label: 'blocks', directed: true, raw: {} }; }

const graph: Graph = {
  nodes: [n('EPIC-1', 'epic'), n('A', 'task', '2026-07-01', '2026-07-05'), n('B', 'task', '2026-07-06', '2026-07-10'), n('C', 'task')],
  edges: [h('EPIC-1', 'A'), h('EPIC-1', 'B'), h('EPIC-1', 'C'), blk('A', 'B')],
};

test('dated issues become bars; later due date sits further right', () => {
  const tl = buildTimeline(graph, 800);
  const a = tl.rows.flatMap((r) => r.bars).find((b) => b.key === 'A')!;
  const b = tl.rows.flatMap((r) => r.bars).find((b) => b.key === 'B')!;
  expect(b.x).toBeGreaterThan(a.x);
  expect(a.width).toBeGreaterThan(0);
});

test('rows are grouped by epic', () => {
  const tl = buildTimeline(graph, 800);
  expect(tl.rows.some((r) => r.epicKey === 'EPIC-1')).toBe(true);
});

test('undated issues are collected separately, not placed as bars', () => {
  const tl = buildTimeline(graph, 800);
  expect(tl.undated.map((u) => u.key)).toContain('C');
});

test('blocks dependencies are reported between dated bars', () => {
  const tl = buildTimeline(graph, 800);
  expect(tl.dependencies).toContainEqual({ fromKey: 'A', toKey: 'B' });
});

test('empty when no node has dates', () => {
  const none: Graph = { nodes: [n('X', 'task')], edges: [] };
  expect(buildTimeline(none, 800).rows.every((r) => r.bars.length === 0)).toBe(true);
});
